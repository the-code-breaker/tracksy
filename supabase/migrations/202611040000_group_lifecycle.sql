-- Groups are removed from member access without destroying the append-only
-- financial ledger. Only an owner can delete a fully settled group.
alter table public.groups add column deleted_at timestamptz;

create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_members m join public.groups g on g.id=m.group_id
 where m.group_id=p_group and m.user_id=auth.uid() and m.active and g.deleted_at is null)
$$;

-- Serialize lifecycle changes with writes. A transaction that has checked an
-- open group holds its shared row lock until its mutation commits.
create or replace function private.require_open(p_group uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare archived timestamptz; removed timestamptz; begin
 perform private.require_member(p_group);
 select archived_at,deleted_at into archived,removed from public.groups where id=p_group for share;
 if not found or removed is not null then raise exception 'Group is no longer available'; end if;
 if archived is not null then raise exception 'Group is archived'; end if;
end $$;

create function public.restore_group(p_group uuid) returns void
language plpgsql security definer set search_path='' as $$
declare g public.groups; begin
 perform private.require_member(p_group);
 select * into g from public.groups where id=p_group for update;
 if g.owner_id<>auth.uid() then raise exception 'Owner required' using errcode='42501'; end if;
 if g.deleted_at is not null then raise exception 'Deleted groups cannot be restored'; end if;
 if g.archived_at is null then return; end if;
 update public.groups set archived_at=null,updated_at=now() where id=p_group;
 perform private.audit(p_group,'group_restored',p_group);
end $$;

create function public.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path='' as $$
declare g public.groups; begin
 perform private.require_member(p_group);
 select * into g from public.groups where id=p_group for update;
 if g.owner_id<>auth.uid() then raise exception 'Owner required' using errcode='42501'; end if;
 if exists(select 1 from public.financial_ledger_entries where group_id=p_group group by user_id,currency having sum(delta_minor)<>0) then
  raise exception 'Settle every member''s outstanding balances in each currency before deleting this group'; end if;
 if exists(select 1 from public.settlements where group_id=p_group and status in('pending','disputed')) then
  raise exception 'Resolve pending or disputed payments before deleting this group'; end if;
 if exists(select 1 from public.billing_purchases where group_id=p_group and renews and status in('active','grace') and current_period_end>now()) then
  raise exception 'Cancel the group''s renewing store subscription before deleting this group'; end if;
 perform private.audit(p_group,'group_deleted',p_group,jsonb_build_object('name',g.name,'records_retained',true));
 update public.recurring_expenses set active=false where group_id=p_group and active;
 update public.group_invitations set expires_at=least(expires_at,now()) where group_id=p_group;
 update private.group_mail set status='failed',invite_token=null where group_id=p_group and status in('pending','sending');
 update public.groups set deleted_at=now(),archived_at=coalesce(archived_at,now()),updated_at=now() where id=p_group;
end $$;

revoke all on function public.restore_group(uuid),public.delete_group(uuid) from public,anon;
grant execute on function public.restore_group(uuid),public.delete_group(uuid) to authenticated;

-- Deleted groups never reopen through accepted invitation links.
create or replace function public.accept_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); inv public.group_invitations; verified boolean; mail text; begin
 select email_confirmed_at is not null, lower(email) into verified,mail from auth.users where id=u;
 if not coalesce(verified,false) then raise exception 'Verify your email before joining'; end if;
 select * into inv from public.group_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if inv.accepted_by=u and public.is_group_member(inv.group_id) then return inv.group_id;end if;
 if inv.id is null or inv.expires_at<=now() or inv.accepted_by is not null then raise exception 'Invalid, expired, or used invitation'; end if;
 if inv.email is not null and inv.email<>mail then raise exception 'Invitation belongs to another email' using errcode='42501'; end if;
 perform 1 from public.groups where id=inv.group_id and archived_at is null and deleted_at is null for update;
 if not found then raise exception 'Group is archived'; end if;
 if (select count(*) from public.group_members where group_id=inv.group_id and active)>=100 then raise exception 'Group member limit reached'; end if;
 if exists(select 1 from public.group_members where group_id=inv.group_id and user_id=u and active) then return inv.group_id;end if;
 insert into public.group_members(group_id,user_id) values(inv.group_id,u) on conflict(group_id,user_id) do update set active=true,role='member',billing_manager=false,left_at=null;
 update public.group_invitations set accepted_by=u,accepted_at=now() where id=inv.id; perform private.audit(inv.group_id,'member_joined',u); return inv.group_id;
end $$;


create or replace function public.invitation_preview(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare inv public.group_invitations;result jsonb;existing boolean;begin
 if p_token !~ '^[a-f0-9]{64}$' then raise exception 'This invitation link is not valid'; end if;
 select * into inv from public.group_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 existing:=inv.id is not null and exists(select 1 from public.group_members m where m.group_id=inv.group_id and m.user_id=auth.uid() and m.active);
 if inv.id is null or ((inv.expires_at<=now() or inv.accepted_by is not null) and not(existing and (inv.accepted_by is null or inv.accepted_by=auth.uid()))) then raise exception 'This invitation has expired or has already been used'; end if;
 select jsonb_build_object('group_name',g.name,'inviter',p.display_name,'expires_at',inv.expires_at,'email_bound',inv.email is not null,'already_member',existing) into result from public.groups g join public.profiles p on p.id=inv.invited_by where g.id=inv.group_id and g.archived_at is null and g.deleted_at is null;
 if result is null then raise exception 'This group is no longer available'; end if;return result;
end $$;

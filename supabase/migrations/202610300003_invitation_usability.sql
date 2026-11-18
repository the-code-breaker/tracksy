create or replace function public.accept_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); inv public.group_invitations; verified boolean; mail text; begin
 select email_confirmed_at is not null, lower(email) into verified,mail from auth.users where id=u;
 if not coalesce(verified,false) then raise exception 'Verify your email before joining'; end if;
 select * into inv from public.group_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if inv.accepted_by=u and exists(select 1 from public.group_members m where m.group_id=inv.group_id and m.user_id=u and m.active) then return inv.group_id;end if;
 if inv.id is null or inv.expires_at<=now() or inv.accepted_by is not null then raise exception 'Invalid, expired, or used invitation'; end if;
 if inv.email is not null and inv.email<>mail then raise exception 'Invitation belongs to another email' using errcode='42501'; end if;
 perform 1 from public.groups where id=inv.group_id and archived_at is null for update;
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
 select jsonb_build_object('group_name',g.name,'inviter',p.display_name,'expires_at',inv.expires_at,'email_bound',inv.email is not null,'already_member',existing) into result from public.groups g join public.profiles p on p.id=inv.invited_by where g.id=inv.group_id and g.archived_at is null;
 if result is null then raise exception 'This group is no longer available'; end if;return result;
end $$;

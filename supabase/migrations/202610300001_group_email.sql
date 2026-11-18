-- Invitations and reminders are user-initiated, rate-limited and delivered only
-- by a server function. Tokens and recipient addresses stay in a private outbox.
create table private.group_mail (
 id uuid primary key default gen_random_uuid(),created_by uuid not null references public.profiles,
 group_id uuid not null references public.groups,kind text not null check(kind in('invite','reminder')),
 recipient text not null,recipient_id uuid references public.profiles,currency text,
 invitation_id uuid references public.group_invitations,invite_token text,request_key uuid not null,
 payload_hash text not null,status text not null default 'pending' check(status in('pending','sending','sent','failed')),
 attempts int not null default 0,claimed_at timestamptz,sent_at timestamptz,created_at timestamptz not null default now(),
 unique(created_by,request_key)
);
create index group_mail_cooldown on private.group_mail(group_id,recipient_id,currency,created_at desc);
alter table private.group_mail enable row level security;

-- Any active member can invite a friend. A link remains a single-use, expiring
-- invitation; joining never recalculates earlier expense allocations.
create or replace function public.invite_member(p_group uuid,p_email text default null) returns text language plpgsql security definer set search_path='' as $$
declare token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');mail text:=nullif(lower(trim(p_email)),''); begin
 perform private.require_open(p_group);
 if mail is not null and (length(mail)>254 or mail !~ '^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') then raise exception 'Enter a valid email address'; end if;
 if (select count(*) from public.group_invitations where invited_by=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit reached. Try again later'; end if;
 insert into public.group_invitations(group_id,token_hash,email,invited_by) values(p_group,encode(sha256(convert_to(token,'UTF8')),'hex'),mail,auth.uid());
 perform private.audit(p_group,'invitation_created',null); return token;
end $$;

create function public.invitation_preview(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare inv public.group_invitations;result jsonb;begin
 if p_token !~ '^[a-f0-9]{64}$' then raise exception 'This invitation link is not valid'; end if;
 select * into inv from public.group_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if inv.id is null or inv.expires_at<=now() or inv.accepted_by is not null then raise exception 'This invitation has expired or has already been used'; end if;
 select jsonb_build_object('group_name',g.name,'inviter',p.display_name,'expires_at',inv.expires_at,'email_bound',inv.email is not null) into result from public.groups g join public.profiles p on p.id=inv.invited_by where g.id=inv.group_id and g.archived_at is null;
 if result is null then raise exception 'This group is no longer available'; end if;return result;
end $$;

create function public.reminder_targets(p_group uuid) returns table(user_id uuid,display_name text,currency text,balance_minor bigint,can_remind boolean,last_sent_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin perform private.require_member(p_group);return query
 with balances as(select l.user_id,l.currency,sum(l.delta_minor)::bigint balance from public.financial_ledger_entries l where l.group_id=p_group group by l.user_id,l.currency)
 select b.user_id,p.display_name,b.currency,b.balance,
 b.user_id<>auth.uid() and b.balance<0 and coalesce(n.reminders,true) and exists(select 1 from balances mine where mine.user_id=auth.uid() and mine.currency=b.currency and mine.balance>0)
 and not exists(select 1 from private.group_mail mail where mail.group_id=p_group and mail.recipient_id=b.user_id and mail.currency=b.currency and mail.kind='reminder' and mail.status in('sent','sending','pending') and mail.created_at>now()-interval '24 hours'),
 (select max(mail.sent_at) from private.group_mail mail where mail.group_id=p_group and mail.recipient_id=b.user_id and mail.currency=b.currency and mail.kind='reminder')
 from balances b join public.profiles p on p.id=b.user_id join public.group_members m on m.group_id=p_group and m.user_id=b.user_id and m.active left join public.notification_preferences n on n.user_id=b.user_id;
end $$;

create function public.prepare_group_mail(p_group uuid,p_kind text,p_key uuid,p_email text default null,p_recipient uuid default null,p_currency text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();job private.group_mail;mail text;token text;invite uuid;hash text;eligible boolean;begin
 perform private.require_open(p_group);
 if p_key is null or p_kind not in('invite','reminder') then raise exception 'Invalid email request'; end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('group',p_group,'kind',p_kind,'email',lower(trim(p_email)),'recipient',p_recipient,'currency',p_currency)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('group-mail:'||u::text,0));
 select * into job from private.group_mail where created_by=u and request_key=p_key for update;
 if job.id is not null then
  if job.payload_hash<>hash then raise exception 'Request key was already used for different email details'; end if;
  return jsonb_build_object('id',job.id,'status',job.status,'link',case when job.kind='invite' and job.invite_token is not null then 'https://tracksy-support.coralprawn64.chatgpt.site/join/?token='||job.invite_token else null end);
 end if;
 if (select count(*) from private.group_mail where created_by=u and created_at>now()-interval '1 hour')>=30 then raise exception 'Email limit reached. Try again later'; end if;
 if p_kind='invite' then
  mail:=lower(trim(p_email));if mail is null or mail='' then raise exception 'Enter an email address'; end if;
  if exists(select 1 from auth.users a join public.group_members m on m.user_id=a.id where m.group_id=p_group and m.active and lower(a.email)=mail) then raise exception 'This person is already in the group'; end if;
  if exists(select 1 from private.group_mail old where old.created_by=u and old.group_id=p_group and old.recipient=mail and old.kind='invite' and old.created_at>now()-interval '5 minutes' and old.status in('pending','sending','sent')) then raise exception 'An invitation was sent recently. Please wait before sending again'; end if;
  token:=public.invite_member(p_group,mail);
  select id into invite from public.group_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 else
  -- Serialize reminders across all senders to the same member/currency.
  perform pg_advisory_xact_lock(hashtextextended(p_group::text||coalesce(p_recipient::text,'')||coalesce(p_currency,''),0));
  select t.can_remind into eligible from public.reminder_targets(p_group) t where t.user_id=p_recipient and t.currency=p_currency;
  if not coalesce(eligible,false) then raise exception 'A reminder is not available for this balance. It may be settled, disabled or recently reminded'; end if;
  select lower(email) into mail from auth.users where id=p_recipient and email_confirmed_at is not null;
  if mail is null then raise exception 'This member needs a verified email before receiving reminders'; end if;
 end if;
 insert into private.group_mail(created_by,group_id,kind,recipient,recipient_id,currency,invitation_id,invite_token,request_key,payload_hash)
 values(u,p_group,p_kind,mail,p_recipient,p_currency,invite,token,p_key,hash) returning * into job;
 return jsonb_build_object('id',job.id,'status',job.status,'link',case when token is not null then 'https://tracksy-support.coralprawn64.chatgpt.site/join/?token='||token else null end);
end $$;

create function public.claim_group_mail(p_id uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.group_mail;begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 select * into job from private.group_mail where id=p_id and created_by=p_user for update;
 if job.id is null then raise exception 'Email request not found';end if;
 if job.status='sent' then return jsonb_build_object('status','sent');end if;
 if job.status='sending' and job.claimed_at>now()-interval '2 minutes' then raise exception 'This email is already being sent';end if;
 if job.attempts>=3 or job.created_at<now()-interval '1 day' then raise exception 'Email retries exhausted. Create a new invitation';end if;
 if job.kind='invite' and not exists(select 1 from public.group_invitations i where i.id=job.invitation_id and i.expires_at>now() and i.accepted_at is null) then raise exception 'Invitation expired or already used';end if;
 if job.kind='reminder' and (not exists(select 1 from public.group_members m where m.group_id=job.group_id and m.user_id=job.created_by and m.active) or not exists(select 1 from public.notification_preferences n where n.user_id=job.recipient_id and n.reminders)) then raise exception 'Reminder permission changed';end if;
 update private.group_mail set status='sending',attempts=attempts+1,claimed_at=now() where id=p_id;
 return(select jsonb_build_object('status','sending','recipient',job.recipient,'group_name',g.name,'sender_name',p.display_name,'kind',job.kind,'link',case when job.kind='invite' then 'https://tracksy-support.coralprawn64.chatgpt.site/join/?token='||job.invite_token else 'https://tracksy-support.coralprawn64.chatgpt.site/open/' end) from public.groups g join public.profiles p on p.id=job.created_by where g.id=job.group_id and g.archived_at is null);
end $$;

create function public.complete_group_mail(p_id uuid,p_user uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$
declare job private.group_mail;begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 select * into job from private.group_mail where id=p_id and created_by=p_user for update;
 if job.id is null or job.status<>'sending' then return;end if;
 update private.group_mail set status=case when p_success then 'sent' else 'failed' end,sent_at=case when p_success then now() else null end,claimed_at=null where id=p_id;
 if p_success then insert into public.expense_audit_events(group_id,actor_id,event_type,entity_id,detail) values(job.group_id,p_user,case when job.kind='invite' then 'invitation_emailed' else 'reminder_emailed' end,job.recipient_id,jsonb_build_object('recipient_id',job.recipient_id));end if;
end $$;

revoke all on private.group_mail from public,anon,authenticated;
revoke execute on function public.invitation_preview(text),public.reminder_targets(uuid),public.prepare_group_mail(uuid,text,uuid,text,uuid,text),public.claim_group_mail(uuid,uuid),public.complete_group_mail(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.invitation_preview(text) to anon,authenticated;
grant execute on function public.reminder_targets(uuid),public.prepare_group_mail(uuid,text,uuid,text,uuid,text) to authenticated;
grant execute on function public.claim_group_mail(uuid,uuid),public.complete_group_mail(uuid,uuid,boolean) to service_role;
-- Realtime uses the recipient RLS policy, never a broad notifications read grant.
alter publication supabase_realtime add table public.notifications;

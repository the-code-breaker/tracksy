-- All financial writes are atomic SECURITY DEFINER RPCs. Client writes are denied.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
 id uuid primary key references auth.users(id), display_name text not null default 'Tracksy member' check(length(display_name) between 1 and 80),
 avatar_path text, currency text not null default 'INR' check(currency in ('INR','USD','EUR','GBP','JPY','KWD')),
 language text not null default 'en' check(language in ('en','hi')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (user_id uuid primary key references public.profiles, theme text not null default 'system' check(theme in ('system','light','dark')), detailed_previews boolean not null default false, timezone text not null default 'Asia/Kolkata' check(timezone in ('Asia/Kolkata','America/New_York','America/Los_Angeles','Europe/London','UTC')), quiet_start time default '22:00', quiet_end time default '08:00', deletion_requested_at timestamptz, updated_at timestamptz not null default now());
create table public.groups (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80), description text not null default '' check(length(description)<=500),
 currency text not null check(currency in ('INR','USD','EUR','GBP','JPY','KWD')), kind text not null default 'friends' check(kind in ('friends','roommates','couples','family','travel','events','office','custom')),
 icon text not null default '◈' check(length(icon)<=8), owner_id uuid not null references public.profiles, cover_path text, archived_at timestamptz, simplified_settlements boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.group_members (group_id uuid not null references public.groups, user_id uuid not null references public.profiles, role text not null default 'member' check(role in ('owner','admin','member')), billing_manager boolean not null default false, active boolean not null default true, joined_at timestamptz not null default now(), left_at timestamptz, primary key(group_id,user_id));
create unique index one_group_owner on public.group_members(group_id) where role='owner' and active;
create index members_user on public.group_members(user_id,group_id) where active;
create table public.group_invitations (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, token_hash text unique not null, email text, invited_by uuid not null references public.profiles, expires_at timestamptz not null default now()+interval '7 days', accepted_by uuid references public.profiles, accepted_at timestamptz, created_at timestamptz not null default now());
create table public.expenses (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, created_by uuid not null references public.profiles,
 description text not null check(length(description) between 1 and 160), amount_minor bigint not null check(amount_minor between 1 and 999999999999),
 currency text not null check(currency in ('INR','USD','EUR','GBP','JPY','KWD')), category text not null check(length(category) between 1 and 40),
 split_method text not null check(split_method in ('equal','exact','percentage','weighted','custom','itemized')), expense_date date not null default current_date,
 notes text not null default '' check(length(notes)<=2000), version int not null default 1, replaces_id uuid references public.expenses, reversed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,group_id)
);
create index expenses_group_date on public.expenses(group_id,expense_date desc,id);
create table public.expense_payers (expense_id uuid not null, group_id uuid not null, user_id uuid not null references public.profiles, amount_minor bigint not null check(amount_minor>=0), primary key(expense_id,user_id), foreign key(expense_id,group_id) references public.expenses(id,group_id));
create table public.expense_participants (expense_id uuid not null, group_id uuid not null, user_id uuid not null references public.profiles, primary key(expense_id,user_id), foreign key(expense_id,group_id) references public.expenses(id,group_id));
create table public.expense_splits (expense_id uuid not null, group_id uuid not null, user_id uuid not null references public.profiles, amount_minor bigint not null check(amount_minor>=0), input_value bigint not null, primary key(expense_id,user_id), foreign key(expense_id,group_id) references public.expenses(id,group_id));
create table public.expense_items (id uuid primary key default gen_random_uuid(), expense_id uuid not null, group_id uuid not null, description text not null, amount_minor bigint not null check(amount_minor between -999999999999 and 999999999999 and amount_minor<>0), allocations jsonb not null, foreign key(expense_id,group_id) references public.expenses(id,group_id));
create table public.expense_attachments (id uuid primary key default gen_random_uuid(), expense_id uuid not null, group_id uuid not null, storage_path text not null unique, uploaded_by uuid not null references public.profiles, created_at timestamptz not null default now(), foreign key(expense_id,group_id) references public.expenses(id,group_id));
create table public.expense_comments (id uuid primary key default gen_random_uuid(), expense_id uuid not null, group_id uuid not null, user_id uuid not null references public.profiles, body text not null check(length(body) between 1 and 2000), created_at timestamptz not null default now(), foreign key(expense_id,group_id) references public.expenses(id,group_id));
create table public.expense_audit_events (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, actor_id uuid not null references public.profiles, event_type text not null, entity_id uuid, detail jsonb not null default '{}', created_at timestamptz not null default now());
create index activity_group_date on public.expense_audit_events(group_id,created_at desc,id);
create table public.settlements (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, from_user uuid not null references public.profiles, to_user uuid not null references public.profiles, amount_minor bigint not null check(amount_minor between 1 and 999999999999), currency text not null check(currency in ('INR','USD','EUR','GBP','JPY','KWD')), method text not null check(method in ('cash','bank','upi','other')), notes text not null default '' check(length(notes)<=2000), payment_reference text not null default '' check(length(payment_reference)<=160), status text not null default 'pending' check(status in ('pending','confirmed','disputed','reversed')), created_by uuid not null references public.profiles, created_at timestamptz not null default now(), check(from_user<>to_user));
create table public.settlement_confirmations (id uuid primary key default gen_random_uuid(), settlement_id uuid not null references public.settlements, group_id uuid not null references public.groups, confirmed_by uuid not null references public.profiles, verification text not null default 'user_reported' check(verification='user_reported'), created_at timestamptz not null default now(), unique(settlement_id));
create table public.financial_ledger_entries (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, user_id uuid not null references public.profiles, currency text not null, delta_minor bigint not null, expense_id uuid references public.expenses, settlement_id uuid references public.settlements, entry_type text not null check(entry_type in ('expense','expense_reversal','settlement','settlement_reversal')), created_at timestamptz not null default now(), check((expense_id is null)<>(settlement_id is null)));
create index ledger_group_currency on public.financial_ledger_entries(group_id,currency,user_id);
create table private.mutation_keys (user_id uuid not null, idempotency_key uuid not null, operation text not null, payload_hash text not null, result_id uuid not null, created_at timestamptz not null default now(), primary key(user_id,idempotency_key));
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, group_id uuid references public.groups, kind text not null, read_at timestamptz, created_at timestamptz not null default now());
create index notifications_user on public.notifications(user_id,created_at desc);
create table public.notification_preferences (user_id uuid primary key references public.profiles, expenses boolean not null default true, settlements boolean not null default true, reminders boolean not null default true, marketing boolean not null default false);
create table public.user_devices (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, push_token text not null unique, platform text not null check(platform in ('ios','android')), created_at timestamptz not null default now());
create table public.support_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, subject text not null check(length(subject) between 1 and 160), body text not null check(length(body)<=5000), status text not null default 'open', created_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());

create function private.require_user() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin if u is null then raise exception 'Authentication required' using errcode='42501'; end if; return u; end $$;
create function public.is_group_member(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.group_members where group_id=p_group and user_id=auth.uid() and active) $$;
create function private.is_manager(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.group_members where group_id=p_group and user_id=auth.uid() and active and role in ('owner','admin')) $$;
create function private.require_member(p_group uuid) returns void language plpgsql stable security definer set search_path='' as $$ begin perform private.require_user(); if not public.is_group_member(p_group) then raise exception 'Group access denied' using errcode='42501'; end if; end $$;
create function private.require_open(p_group uuid) returns void language plpgsql stable security definer set search_path='' as $$ begin perform private.require_member(p_group); if exists(select 1 from public.groups where id=p_group and archived_at is not null) then raise exception 'Group is archived'; end if; end $$;
create function private.audit(p_group uuid,p_type text,p_entity uuid,p_detail jsonb default '{}') returns void language sql security definer set search_path='' as $$ insert into public.expense_audit_events(group_id,actor_id,event_type,entity_id,detail) values(p_group,auth.uid(),p_type,p_entity,p_detail) $$;
create function private.on_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'display_name',80),''),'Tracksy member')); insert into public.user_preferences(user_id) values(new.id); insert into public.notification_preferences(user_id) values(new.id); return new; end $$;
create trigger user_created after insert on auth.users for each row execute function private.on_user();
create function private.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Append-only records cannot be changed'; end $$;
create trigger ledger_immutable before update or delete on public.financial_ledger_entries for each row execute function private.immutable();
create trigger audit_immutable before update or delete on public.expense_audit_events for each row execute function private.immutable();
create trigger admin_audit_immutable before update or delete on public.audit_logs for each row execute function private.immutable();

-- Enable RLS on every public table, including future empty operational tables.
do $$ declare t record; begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t.tablename); end loop; end $$;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy groups_read on public.groups for select to authenticated using(public.is_group_member(id));
do $$ declare t text; begin foreach t in array array['group_members','group_invitations','expenses','expense_payers','expense_participants','expense_splits','expense_items','expense_attachments','expense_comments','expense_audit_events','settlements','settlement_confirmations','financial_ledger_entries'] loop execute format('create policy member_read on public.%I for select to authenticated using(public.is_group_member(group_id))',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['user_preferences','notification_preferences','user_devices','support_requests'] loop execute format('create policy self_read on public.%I for select to authenticated using(user_id=auth.uid())',t); end loop; end $$;
create policy prefs_update on public.user_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notification_prefs_update on public.notification_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy devices_insert on public.user_devices for insert to authenticated with check(user_id=auth.uid());
create policy devices_delete on public.user_devices for delete to authenticated using(user_id=auth.uid());
create policy support_insert on public.support_requests for insert to authenticated with check(user_id=auth.uid() and status='open');
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on all tables in schema public from anon,authenticated;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant update(display_name,avatar_path,currency,language,updated_at) on public.profiles to authenticated;
grant update(theme,detailed_previews,timezone,quiet_start,quiet_end,updated_at) on public.user_preferences to authenticated;
grant update(expenses,settlements,reminders,marketing) on public.notification_preferences to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant insert,delete on public.user_devices to authenticated;
grant insert on public.support_requests to authenticated;

create function public.create_group(p_name text,p_currency text,p_kind text default 'friends',p_description text default '',p_icon text default '◈') returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); g uuid; begin
 if (select count(*) from public.groups where owner_id=u and created_at>now()-interval '1 day')>=20 then raise exception 'Daily group limit reached'; end if;
 insert into public.groups(name,currency,kind,description,icon,owner_id) values(trim(p_name),p_currency,p_kind,p_description,p_icon,u) returning id into g;
 insert into public.group_members(group_id,user_id,role,billing_manager) values(g,u,'owner',true); perform private.audit(g,'group_created',g); return g;
end $$;
create function public.list_members(p_group uuid) returns table(user_id uuid,display_name text,role text,active boolean) language plpgsql security definer set search_path='' as $$ begin perform private.require_member(p_group); return query select m.user_id,p.display_name,m.role,m.active from public.group_members m join public.profiles p on p.id=m.user_id where m.group_id=p_group order by m.joined_at; end $$;
create function public.invite_member(p_group uuid,p_email text default null) returns text language plpgsql security definer set search_path='' as $$
declare token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); begin
 perform private.require_open(p_group); if not private.is_manager(p_group) then raise exception 'Manager role required' using errcode='42501'; end if;
 if (select count(*) from public.group_invitations where invited_by=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation rate limit'; end if;
 insert into public.group_invitations(group_id,token_hash,email,invited_by) values(p_group,encode(sha256(convert_to(token,'UTF8')),'hex'),nullif(lower(trim(p_email)),''),auth.uid());
 perform private.audit(p_group,'invitation_created',null); return token;
end $$;
create function public.accept_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); inv public.group_invitations; verified boolean; mail text; begin
 select email_confirmed_at is not null, lower(email) into verified,mail from auth.users where id=u;
 if not coalesce(verified,false) then raise exception 'Verify your email before joining'; end if;
 select * into inv from public.group_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if inv.id is null or inv.expires_at<=now() or inv.accepted_by is not null then raise exception 'Invalid, expired, or used invitation'; end if;
 if inv.email is not null and inv.email<>mail then raise exception 'Invitation belongs to another email' using errcode='42501'; end if;
 perform 1 from public.groups where id=inv.group_id and archived_at is null for update;
 if not found then raise exception 'Group is archived'; end if;
 if (select count(*) from public.group_members where group_id=inv.group_id and active)>=100 then raise exception 'Group member limit reached'; end if;
 if exists(select 1 from public.group_members where group_id=inv.group_id and user_id=u and active) then raise exception 'Already a group member'; end if;
 insert into public.group_members(group_id,user_id) values(inv.group_id,u) on conflict(group_id,user_id) do update set active=true,role='member',billing_manager=false,left_at=null;
 update public.group_invitations set accepted_by=u,accepted_at=now() where id=inv.id; perform private.audit(inv.group_id,'member_joined',u); return inv.group_id;
end $$;
create function public.group_balances(p_group uuid) returns table(group_id uuid,user_id uuid,currency text,balance_minor bigint) language plpgsql security definer set search_path='' as $$ begin perform private.require_member(p_group); return query select l.group_id,l.user_id,l.currency,sum(l.delta_minor)::bigint from public.financial_ledger_entries l where l.group_id=p_group group by l.group_id,l.user_id,l.currency; end $$;

-- Serializes duplicate mutations before checking payload and returning the original result.
create function private.replay(p_key uuid,p_operation text,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r private.mutation_keys; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into r from private.mutation_keys where user_id=auth.uid() and idempotency_key=p_key;
 if found then if r.operation<>p_operation or r.payload_hash<>encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') then raise exception 'Idempotency key reused with a different payload'; end if; return r.result_id; end if; return null;
end $$;
create function private.remember(p_key uuid,p_operation text,p_payload jsonb,p_result uuid) returns void language sql security definer set search_path='' as $$ insert into private.mutation_keys(user_id,idempotency_key,operation,payload_hash,result_id) values(auth.uid(),p_key,p_operation,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),p_result) $$;

-- Defined here with no premium access; replaced by the entitlement migration.
create function public.has_group_feature(p_user uuid,p_group uuid,p_feature text) returns boolean language sql stable security definer set search_path='' as $$ select false $$;

create function private.reverse_expense(p_expense uuid,p_version int) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.expenses; begin
 select * into e from public.expenses where id=p_expense for update; perform private.require_open(e.group_id);
 if e.created_by<>auth.uid() and not private.is_manager(e.group_id) then raise exception 'Expense author or manager required' using errcode='42501'; end if;
 if e.version<>p_version or e.reversed_at is not null then raise exception 'Expense changed. Refresh before trying again' using errcode='40001'; end if;
 insert into public.financial_ledger_entries(group_id,user_id,currency,delta_minor,expense_id,entry_type) select group_id,user_id,currency,-delta_minor,expense_id,'expense_reversal' from public.financial_ledger_entries where expense_id=p_expense and entry_type='expense';
 update public.expenses set reversed_at=now(),version=version+1,updated_at=now() where id=p_expense; perform private.audit(e.group_id,'expense_reversed',p_expense); return p_expense;
end $$;
create function public.reverse_expense(p_expense uuid,p_version int,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$ declare prior uuid; payload jsonb:=jsonb_build_object('id',p_expense,'v',p_version); begin perform private.require_user(); prior:=private.replay(p_key,'reverse',payload); if prior is not null then return prior; end if; prior:=private.reverse_expense(p_expense,p_version); perform private.remember(p_key,'reverse',payload,prior); return prior; end $$;

create function public.create_expense(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); g uuid:=(p->>'group_id')::uuid; total bigint:=(p->>'amount_minor')::bigint;
 curr text:=p->>'currency'; method text:=p->>'split_method'; participants jsonb:=p->'participants'; n int; denom numeric; funded numeric; e uuid; prior uuid; row record; key uuid:=(p->>'idempotency_key')::uuid;
begin
 perform private.require_open(g); if key is null then raise exception 'Idempotency key required'; end if;
 prior:=private.replay(key,'expense',p); if prior is not null then return prior; end if;
 perform 1 from public.groups where id=g for update;
 perform private.require_open(g);
 if total is null or total<1 or total>999999999999 then raise exception 'Invalid total'; end if;
 if curr is null or curr not in ('INR','USD','EUR','GBP','JPY','KWD') then raise exception 'Unsupported currency'; end if;
 if jsonb_typeof(participants)<>'array' or jsonb_typeof(p->'payers')<>'array' then raise exception 'Participants and payers required'; end if;
 if method='itemized' then participants:=private.itemized_shares(total,p->'items'); end if;
 n:=jsonb_array_length(participants);
 if n<1 or n>100 or jsonb_array_length(p->'payers') not between 1 and 100 then raise exception 'Invalid participant count'; end if;
 if (select count(distinct x->>'user_id') from jsonb_array_elements(participants) x)<>n then raise exception 'Duplicate participants'; end if;
 if (select count(distinct x->>'user_id') from jsonb_array_elements(p->'payers') x)<>jsonb_array_length(p->'payers') then raise exception 'Duplicate payers'; end if;
 for row in select x->>'user_id' uid,x->>'value' val from jsonb_array_elements(participants) x loop
  if not exists(select 1 from public.group_members where group_id=g and user_id=row.uid::uuid and active) then raise exception 'Participant is not an active member'; end if;
  if method<>'equal' and (row.val is null or row.val !~ '^\d+$' or row.val::numeric>999999999999) then raise exception 'Invalid split value'; end if;
 end loop;
 for row in select x->>'user_id' uid,x->>'amount_minor' val from jsonb_array_elements(p->'payers') x loop
  if not exists(select 1 from public.group_members where group_id=g and user_id=row.uid::uuid and active) then raise exception 'Payer is not an active member'; end if;
  if row.val is null or row.val !~ '^\d+$' or row.val::numeric>999999999999 then raise exception 'Invalid payer amount'; end if;
 end loop;
 select sum((x->>'amount_minor')::numeric) into funded from jsonb_array_elements(p->'payers') x;
 if funded<>total then raise exception 'Payers must fund the total'; end if;
 select sum(case when method='equal' then 1 else (x->>'value')::numeric end) into denom from jsonb_array_elements(participants) x;
 if method in ('exact','custom','itemized') and denom<>total then raise exception 'Shares must equal total'; end if;
 if method='percentage' and denom<>10000 then raise exception 'Percentages must total 10000 basis points'; end if;
 if denom<=0 then raise exception 'Positive weights required'; end if;
 if method='itemized' and not public.has_group_feature(u,g,'itemized') then raise exception 'Group Plus required' using errcode='42501'; end if;
 if p->>'replaces_id' is not null then
  if not exists(select 1 from public.expenses where id=(p->>'replaces_id')::uuid and group_id=g) then raise exception 'Correction group mismatch'; end if;
  if p->>'expected_version' is null then raise exception 'Expected version required'; end if;
  perform private.reverse_expense((p->>'replaces_id')::uuid,(p->>'expected_version')::int);
 end if;
 if (select count(*) from public.expenses where created_by=u and created_at>now()-interval '1 hour')>=300 then raise exception 'Expense rate limit'; end if;
 insert into public.expenses(group_id,created_by,description,amount_minor,currency,category,split_method,expense_date,notes,replaces_id)
 values(g,u,trim(p->>'description'),total,curr,p->>'category',method,(p->>'expense_date')::date,coalesce(p->>'notes',''),(p->>'replaces_id')::uuid) returning id into e;
 insert into public.expense_payers select e,g,(x->>'user_id')::uuid,(x->>'amount_minor')::bigint from jsonb_array_elements(p->'payers') x;
 if method='itemized' then insert into public.expense_items(expense_id,group_id,description,amount_minor,allocations) select e,g,x->>'description',(x->>'amount_minor')::bigint,x->'allocations' from jsonb_array_elements(p->'items') x; end if;
 insert into public.expense_participants select e,g,(x->>'user_id')::uuid from jsonb_array_elements(participants) x;
 if method in ('exact','custom','itemized') then
  insert into public.expense_splits select e,g,(x->>'user_id')::uuid,(x->>'value')::bigint,(x->>'value')::bigint from jsonb_array_elements(participants) x;
 else
  -- NUMERIC multiplication avoids bigint overflow. No floating point is involved.
  insert into public.expense_splits(expense_id,group_id,user_id,amount_minor,input_value)
  with inputs as (select (x->>'user_id')::uuid uid,case when method='equal' then 1 else (x->>'value')::numeric end weight from jsonb_array_elements(participants) x),
  base as (select uid,weight,floor(total::numeric*weight/denom) amount,mod(total::numeric*weight,denom) rem from inputs),
  ranked as (select *,row_number() over(order by rem desc,uid) rank,total-sum(amount) over() leftover from base)
  select e,g,uid,(amount+case when rank<=leftover then 1 else 0 end)::bigint,weight::bigint from ranked;
 end if;
 insert into public.financial_ledger_entries(group_id,user_id,currency,delta_minor,expense_id,entry_type)
 select g,uid,curr,sum(delta)::bigint,e,'expense' from (select user_id uid,amount_minor delta from public.expense_payers where expense_id=e union all select user_id,-amount_minor from public.expense_splits where expense_id=e) x group by uid;
 if (select sum(delta_minor) from public.financial_ledger_entries where expense_id=e)<>0 then raise exception 'Ledger must balance'; end if;
 perform private.audit(g,case when p->>'replaces_id' is null then 'expense_added' else 'expense_corrected' end,e,jsonb_build_object('description',p->>'description','currency',curr,'amount_minor',total));
 insert into public.notifications(user_id,group_id,kind) select user_id,g,'expense_added' from public.group_members where group_id=g and active and user_id<>u;
 perform private.remember(key,'expense',p,e); return e;
end $$;

create function public.create_settlement(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); g uuid:=(p->>'group_id')::uuid; f uuid:=(p->>'from_user')::uuid; t uuid:=(p->>'to_user')::uuid; s uuid; prior uuid; k uuid:=(p->>'idempotency_key')::uuid; begin
 perform private.require_open(g); if k is null then raise exception 'Idempotency key required'; end if; prior:=private.replay(k,'settlement',p); if prior is not null then return prior; end if;
 if u<>f and u<>t then raise exception 'Only payment parties can record a settlement' using errcode='42501'; end if;
 if not exists(select 1 from public.group_members where group_id=g and user_id=f) or not exists(select 1 from public.group_members where group_id=g and user_id=t) then raise exception 'Payment parties must belong to group'; end if;
 insert into public.settlements(group_id,from_user,to_user,amount_minor,currency,method,notes,payment_reference,created_by) values(g,f,t,(p->>'amount_minor')::bigint,p->>'currency',p->>'method',coalesce(p->>'notes',''),coalesce(p->>'payment_reference',''),u) returning id into s;
 perform private.audit(g,'settlement_requested',s); perform private.remember(k,'settlement',p,s); return s;
end $$;
create function public.respond_settlement(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare s public.settlements; u uuid:=private.require_user(); begin
 select * into s from public.settlements where id=p_id for update; perform private.require_open(s.group_id);
 if u<>s.from_user and u<>s.to_user then raise exception 'Only payment parties may respond' using errcode='42501'; end if;
 if p_action='confirm' then
  if s.status='confirmed' then return; end if;
  if u=s.created_by then raise exception 'The other payment party must confirm'; end if;
  if s.status<>'pending' then raise exception 'Settlement is not pending'; end if;
  insert into public.settlement_confirmations(settlement_id,group_id,confirmed_by) values(s.id,s.group_id,u);
  insert into public.financial_ledger_entries(group_id,user_id,currency,delta_minor,settlement_id,entry_type) values(s.group_id,s.from_user,s.currency,s.amount_minor,s.id,'settlement'),(s.group_id,s.to_user,s.currency,-s.amount_minor,s.id,'settlement');
  update public.settlements set status='confirmed' where id=s.id;
 elsif p_action='dispute' then
  if s.status<>'pending' then raise exception 'Only pending payments may be disputed'; end if; update public.settlements set status='disputed' where id=s.id;
 elsif p_action='reverse' then
  if s.status='reversed' then return; end if;
  if s.status<>'confirmed' then raise exception 'Only confirmed settlements may be reversed'; end if;
  insert into public.financial_ledger_entries(group_id,user_id,currency,delta_minor,settlement_id,entry_type) select group_id,user_id,currency,-delta_minor,settlement_id,'settlement_reversal' from public.financial_ledger_entries where settlement_id=s.id and entry_type='settlement';
  update public.settlements set status='reversed' where id=s.id;
 else raise exception 'Unknown action'; end if;
 perform private.audit(s.group_id,'settlement_'||p_action,s.id);
end $$;

create function public.manage_member(p_group uuid,p_user uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); owner uuid; begin
 perform private.require_open(p_group); select owner_id into owner from public.groups where id=p_group for update;
 if p_action='leave' then
  if p_user<>u then raise exception 'Cannot leave for another member'; end if;
 elsif owner<>u then raise exception 'Owner required' using errcode='42501'; end if;
 if p_action in ('remove','leave') then
  if p_user=owner then raise exception 'Transfer ownership before leaving'; end if;
  if exists(select 1 from public.financial_ledger_entries where group_id=p_group and user_id=p_user group by currency having sum(delta_minor)<>0) then raise exception 'Settle outstanding balances before leaving'; end if;
  update public.group_members set active=false,left_at=now(),billing_manager=false where group_id=p_group and user_id=p_user;
 elsif p_action='transfer' then
  if p_user=u or not exists(select 1 from public.group_members where group_id=p_group and user_id=p_user and active) then raise exception 'Choose another active member'; end if;
  update public.group_members set role='admin' where group_id=p_group and user_id=u;
  update public.group_members set role='owner' where group_id=p_group and user_id=p_user;
  update public.groups set owner_id=p_user,updated_at=now() where id=p_group;
 elsif p_action in ('admin','member') then update public.group_members set role=p_action where group_id=p_group and user_id=p_user and user_id<>owner and active;
 elsif p_action='billing_manager' then update public.group_members set billing_manager=not billing_manager where group_id=p_group and user_id=p_user and active;
 else raise exception 'Unknown action'; end if; perform private.audit(p_group,'member_'||p_action,p_user);
end $$;
create function public.archive_group(p_group uuid) returns void language plpgsql security definer set search_path='' as $$ begin perform private.require_open(p_group); if not exists(select 1 from public.groups where id=p_group and owner_id=auth.uid()) then raise exception 'Owner required'; end if; update public.groups set archived_at=now() where id=p_group; perform private.audit(p_group,'group_archived',p_group); end $$;
create function public.add_comment(p_expense uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$ declare g uuid; c uuid; begin select group_id into g from public.expenses where id=p_expense; perform private.require_open(g); insert into public.expense_comments(expense_id,group_id,user_id,body) values(p_expense,g,auth.uid(),trim(p_body)) returning id into c; perform private.audit(g,'comment_added',p_expense); return c; end $$;
create function public.request_account_deletion() returns void language plpgsql security definer set search_path='' as $$ begin perform private.require_user(); if exists(select 1 from public.groups where owner_id=auth.uid() and archived_at is null) then raise exception 'Transfer or archive owned groups first'; end if; update public.user_preferences set deletion_requested_at=now() where user_id=auth.uid(); insert into public.audit_logs(actor_id,action) values(auth.uid(),'account_deletion_requested'); end $$;

-- Remove PostgreSQL's default PUBLIC execution privilege. Grant only explicit API surface.
revoke execute on all functions in schema public from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function public.is_group_member(uuid),public.has_group_feature(uuid,uuid,text),public.create_group(text,text,text,text,text),public.list_members(uuid),public.invite_member(uuid,text),public.accept_invitation(text),public.group_balances(uuid),public.create_expense(jsonb),public.reverse_expense(uuid,int,uuid),public.create_settlement(jsonb),public.respond_settlement(uuid,text),public.manage_member(uuid,uuid,text),public.archive_group(uuid),public.add_comment(uuid,text),public.request_account_deletion() to authenticated;

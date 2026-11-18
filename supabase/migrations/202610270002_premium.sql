create table public.billing_customers (user_id uuid primary key references public.profiles, revenuecat_id text unique not null, created_at timestamptz not null default now());
create table public.billing_purchase_intents (id uuid primary key default gen_random_uuid(), purchaser_id uuid not null references public.profiles, group_id uuid not null references public.groups, product_id text not null, expires_at timestamptz not null default now()+interval '1 hour', consumed_at timestamptz, created_at timestamptz not null default now());
create unique index one_pending_purchase on public.billing_purchase_intents(purchaser_id) where consumed_at is null;
create table public.billing_purchases (id uuid primary key default gen_random_uuid(), purchaser_id uuid not null references public.profiles, group_id uuid not null references public.groups, provider text not null check(provider in ('APP_STORE','PLAY_STORE','STRIPE')), original_transaction_id text not null, product_id text not null, status text not null check(status in ('active','grace','cancelled','expired','revoked')), current_period_start timestamptz not null, current_period_end timestamptz not null, renews boolean not null, last_event_ms bigint not null default 0, created_at timestamptz not null default now(), unique(provider,original_transaction_id));
-- First release: one immutable beneficiary per purchaser, including after expiration.
-- This fails closed on store ownership ambiguity; a future migration may add vetted slots.
create unique index one_store_slot_per_payer on public.billing_purchases(purchaser_id);
create table public.group_subscription_entitlements (group_id uuid primary key references public.groups, purchase_id uuid unique not null references public.billing_purchases, purchaser_id uuid not null references public.profiles, status text not null check(status in ('active','grace','cancelled','expired','revoked')), expires_at timestamptz not null, renews boolean not null, updated_at timestamptz not null default now());
create table public.billing_events (id text primary key, provider text not null, event_type text not null, event_timestamp_ms bigint not null, purchase_id uuid references public.billing_purchases, disposition text not null, created_at timestamptz not null default now());
create trigger billing_events_immutable before update or delete on public.billing_events for each row execute function private.immutable();
create table public.premium_feature_usage (group_id uuid not null references public.groups, feature_key text not null, period date not null, used int not null default 0 check(used>=0), primary key(group_id,feature_key,period));
create table public.group_feature_settings (group_id uuid not null references public.groups, feature_key text not null, enabled boolean not null default true, primary key(group_id,feature_key));
create table public.budgets (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, month date not null check(extract(day from month)=1), currency text not null check(currency in ('INR','USD','EUR','GBP','JPY','KWD')), amount_minor bigint not null check(amount_minor between 1 and 999999999999), alert_percent int not null default 80 check(alert_percent between 1 and 100), created_by uuid not null references public.profiles, created_at timestamptz not null default now(), unique(group_id,month,currency));
create table public.budget_categories (id uuid primary key default gen_random_uuid(), budget_id uuid not null references public.budgets, group_id uuid not null references public.groups, category text not null, amount_minor bigint not null check(amount_minor>0), unique(budget_id,category));
create table public.recurring_expenses (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, created_by uuid not null references public.profiles, template jsonb not null, next_date date not null, end_date date, interval_months int not null default 1 check(interval_months between 1 and 12), auto_post boolean not null default false, active boolean not null default true, created_at timestamptz not null default now());
create table public.recurring_expense_runs (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, recurring_id uuid not null references public.recurring_expenses, scheduled_date date not null, expense_id uuid references public.expenses, status text not null default 'awaiting_approval', unique(recurring_id,scheduled_date));
create table public.custom_split_rules (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups, name text not null check(length(name) between 1 and 80), split_method text not null check(split_method in ('equal','percentage','weighted','exact','custom')), participants jsonb not null, created_by uuid not null references public.profiles, created_at timestamptz not null default now());
create table public.exchange_rates (id uuid primary key default gen_random_uuid(), base_currency text not null, quote_currency text not null, numerator bigint not null check(numerator>0), denominator bigint not null check(denominator>0), source text not null, effective_at timestamptz not null, unique(base_currency,quote_currency,effective_at));
create table public.product_flags (key text primary key, enabled boolean not null default false);
insert into public.product_flags values('receipt_scan',false),('assistant',false),('trip_mode',false),('personal_expenses',false);
do $$ declare t text; begin foreach t in array array['billing_customers','billing_purchase_intents','billing_purchases','group_subscription_entitlements','billing_events','premium_feature_usage','group_feature_settings','budgets','budget_categories','recurring_expenses','recurring_expense_runs','custom_split_rules','exchange_rates','product_flags'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['group_subscription_entitlements','premium_feature_usage','group_feature_settings','budgets','budget_categories','recurring_expenses','recurring_expense_runs','custom_split_rules'] loop execute format('create policy member_read on public.%I for select to authenticated using(public.is_group_member(group_id))',t); end loop; end $$;
create policy customer_read on public.billing_customers for select to authenticated using(user_id=auth.uid());
create policy purchase_read on public.billing_purchases for select to authenticated using(purchaser_id=auth.uid());
create policy intent_read on public.billing_purchase_intents for select to authenticated using(purchaser_id=auth.uid());
create policy flags_read on public.product_flags for select to authenticated using(true);
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;

create or replace function public.has_group_feature(p_user uuid,p_group uuid,p_feature text) returns boolean language sql stable security definer set search_path='' as $$
 select p_user=auth.uid() and public.is_group_member(p_group)
 and p_feature in ('itemized','budgets','analytics','settlement_plan','recurring','reports','custom_rules')
 and exists(select 1 from public.group_subscription_entitlements where group_id=p_group and status in ('active','grace','cancelled') and expires_at>now())
 and not exists(select 1 from public.group_feature_settings where group_id=p_group and feature_key=p_feature and not enabled)
$$;

create function public.begin_group_purchase(p_group uuid,p_product text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); i uuid; begin
 perform private.require_open(p_group); perform pg_advisory_xact_lock(hashtextextended(u::text,1));
 if not exists(select 1 from public.group_members where group_id=p_group and user_id=u and active and billing_manager) then raise exception 'Billing manager role required' using errcode='42501'; end if;
 if exists(select 1 from public.billing_purchases where purchaser_id=u and group_id<>p_group) then raise exception 'Your store subscription is already assigned to another group'; end if;
 if exists(select 1 from public.group_subscription_entitlements where group_id=p_group and expires_at>now() and status in ('active','grace','cancelled')) then raise exception 'This group already has an active subscription'; end if;
 if p_product not in ('tracksy_group_monthly','tracksy_group_yearly') then raise exception 'Unknown product'; end if;
 update public.billing_purchase_intents set consumed_at=now() where purchaser_id=u and consumed_at is null and expires_at<=now();
 select id into i from public.billing_purchase_intents where purchaser_id=u and consumed_at is null and group_id=p_group and product_id=p_product;
 if i is not null then return i; end if;
 if exists(select 1 from public.billing_purchase_intents where purchaser_id=u and consumed_at is null) then raise exception 'Another purchase is in progress'; end if;
 insert into public.billing_customers(user_id,revenuecat_id) values(u,u::text) on conflict do nothing;
 insert into public.billing_purchase_intents(purchaser_id,group_id,product_id) values(u,p_group,p_product) returning id into i; return i;
end $$;

-- SERVICE ROLE ONLY. Edge function verifies webhook authentication and fetches RevenueCat's
-- current server-side subscriber state before calling this transaction.
create function public.apply_verified_billing(p jsonb) returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=(p->>'user_id')::uuid; b public.billing_purchases; intent public.billing_purchase_intents; groupid uuid; result text; stamp bigint:=(p->>'event_timestamp_ms')::bigint; begin
 if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,1));
 if exists(select 1 from public.billing_events where id=p->>'event_id') then return 'duplicate'; end if;
 select * into b from public.billing_purchases where provider=p->>'provider' and original_transaction_id=p->>'original_transaction_id' for update;
 if b.id is not null and b.purchaser_id<>u then raise exception 'Purchase belongs to another account'; end if;
 if b.id is null then
  select * into intent from public.billing_purchase_intents where purchaser_id=u and consumed_at is null and expires_at>now() and product_id=p->>'product_id' for update;
  if intent.id is null then raise exception 'No authorized purchase intent'; end if;
  groupid:=intent.group_id; perform 1 from public.groups where id=groupid for update;
  if not exists(select 1 from public.group_members where group_id=groupid and user_id=u and active and billing_manager) then raise exception 'Purchase authorization changed'; end if;
  if exists(select 1 from public.group_subscription_entitlements where group_id=groupid and expires_at>now() and status in ('active','grace','cancelled')) then raise exception 'Group already subscribed'; end if;
  insert into public.billing_purchases(purchaser_id,group_id,provider,original_transaction_id,product_id,status,current_period_start,current_period_end,renews,last_event_ms)
  values(u,groupid,p->>'provider',p->>'original_transaction_id',p->>'product_id',p->>'status',(p->>'starts_at')::timestamptz,(p->>'expires_at')::timestamptz,(p->>'renews')::boolean,stamp) returning * into b;
  update public.billing_purchase_intents set consumed_at=now() where id=intent.id; result:='applied';
 elsif stamp<=b.last_event_ms then result:='stale';
 else
  update public.billing_purchases set status=p->>'status',current_period_start=(p->>'starts_at')::timestamptz,current_period_end=(p->>'expires_at')::timestamptz,renews=(p->>'renews')::boolean,last_event_ms=stamp,product_id=p->>'product_id' where id=b.id returning * into b; result:='applied';
 end if;
 if result='applied' then
  insert into public.group_subscription_entitlements(group_id,purchase_id,purchaser_id,status,expires_at,renews) values(b.group_id,b.id,u,b.status,b.current_period_end,b.renews)
  on conflict(group_id) do update set purchase_id=excluded.purchase_id,purchaser_id=excluded.purchaser_id,status=excluded.status,expires_at=excluded.expires_at,renews=excluded.renews,updated_at=now();
 end if;
 insert into public.billing_events(id,provider,event_type,event_timestamp_ms,purchase_id,disposition) values(p->>'event_id',p->>'provider',p->>'event_type',stamp,b.id,result); return result;
end $$;

create function public.set_budget(p_group uuid,p_month date,p_currency text,p_amount bigint) returns uuid language plpgsql security definer set search_path='' as $$ declare b uuid; begin
 perform private.require_open(p_group); if not private.is_manager(p_group) or not public.has_group_feature(auth.uid(),p_group,'budgets') then raise exception 'Group Plus and manager role required' using errcode='42501'; end if;
 insert into public.budgets(group_id,month,currency,amount_minor,created_by) values(p_group,p_month,p_currency,p_amount,auth.uid()) on conflict(group_id,month,currency) do update set amount_minor=excluded.amount_minor returning id into b; perform private.audit(p_group,'budget_updated',b); return b;
end $$;
create function public.group_analytics(p_group uuid,p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
 perform private.require_member(p_group); if p_end<p_start or p_end-p_start>366 then raise exception 'Select a date range within one year'; end if;
 if not public.has_group_feature(auth.uid(),p_group,'analytics') then raise exception 'Group Plus required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(x),'[]') into result from (select currency,category,date_trunc('month',expense_date)::date as month,sum(amount_minor)::bigint amount_minor,count(*) count from public.expenses where group_id=p_group and reversed_at is null and expense_date between p_start and p_end group by currency,category,date_trunc('month',expense_date)) x; return result;
end $$;
create function public.export_group(p_group uuid,p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
 perform private.require_member(p_group); if p_end<p_start or p_end-p_start>366 then raise exception 'Select up to one year'; end if;
 select coalesce(jsonb_agg(x),'[]') into result from (select id,description,amount_minor,currency,category,expense_date,reversed_at,created_by from public.expenses where group_id=p_group and expense_date between p_start and p_end order by expense_date,id limit 10000) x; return result;
end $$;
create function public.save_split_rule(p_group uuid,p_name text,p_method text,p_participants jsonb) returns uuid language plpgsql security definer set search_path='' as $$ declare r uuid; begin
 perform private.require_open(p_group); if not private.is_manager(p_group) or not public.has_group_feature(auth.uid(),p_group,'custom_rules') then raise exception 'Group Plus and manager required'; end if;
 if jsonb_typeof(p_participants)<>'array' or jsonb_array_length(p_participants) not between 1 and 100 then raise exception 'Participants required'; end if;
 insert into public.custom_split_rules(group_id,name,split_method,participants,created_by) values(p_group,trim(p_name),p_method,p_participants,auth.uid()) returning id into r; return r;
end $$;

-- Admin console is limited to aggregate metadata. Never exposes expense rows.
create function public.admin_metrics() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Admin role and MFA required' using errcode='42501'; end if;
 insert into public.audit_logs(actor_id,action) values(auth.uid(),'admin_metrics_viewed');
 return jsonb_build_object('users',(select count(*) from public.profiles),'groups',(select count(*) from public.groups),'active_premium_groups',(select count(*) from public.group_subscription_entitlements where expires_at>now() and status in ('active','grace','cancelled')),'open_support_requests',(select count(*) from public.support_requests where status='open'),'billing_events',(select count(*) from public.billing_events));
end $$;
revoke execute on function public.begin_group_purchase(uuid,text),public.apply_verified_billing(jsonb),public.set_budget(uuid,date,text,bigint),public.group_analytics(uuid,date,date),public.export_group(uuid,date,date),public.save_split_rule(uuid,text,text,jsonb),public.admin_metrics() from public,anon,authenticated;
grant execute on function public.begin_group_purchase(uuid,text),public.set_budget(uuid,date,text,bigint),public.group_analytics(uuid,date,date),public.export_group(uuid,date,date),public.save_split_rule(uuid,text,text,jsonb),public.admin_metrics() to authenticated;
grant execute on function public.apply_verified_billing(jsonb) to service_role;

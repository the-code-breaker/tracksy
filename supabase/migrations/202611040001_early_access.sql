-- A server-controlled launch benefit, not a purchase or a fabricated store
-- entitlement. Turning this flag off later restores normal paid access rules.
insert into public.product_flags(key,enabled) values('group_plus_early_access',true)
on conflict(key) do update set enabled=excluded.enabled;

create function public.group_plus_early_access() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce((select enabled from public.product_flags where key='group_plus_early_access'),false)
$$;
revoke all on function public.group_plus_early_access() from public,anon;
grant execute on function public.group_plus_early_access() to authenticated;

create or replace function public.has_group_feature(p_user uuid,p_group uuid,p_feature text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user=auth.uid() and public.is_group_member(p_group)
 and p_feature in ('itemized','budgets','analytics','settlement_plan','recurring','reports','custom_rules')
 and (public.group_plus_early_access() or exists(select 1 from public.group_subscription_entitlements where group_id=p_group and status in('active','grace','cancelled') and expires_at>now()))
 and not exists(select 1 from public.group_feature_settings where group_id=p_group and feature_key=p_feature and not enabled)
$$;

-- Older clients must not begin a paid checkout while access is complimentary.
create or replace function public.begin_group_purchase(p_group uuid,p_product text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); i uuid; begin
 perform private.require_open(p_group);
 if public.group_plus_early_access() then raise exception 'Group Plus is free during early access. No purchase is needed'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,1));
 if not exists(select 1 from public.group_members where group_id=p_group and user_id=u and active and billing_manager) then raise exception 'Billing manager role required' using errcode='42501'; end if;
 if exists(select 1 from public.billing_purchases where purchaser_id=u and group_id<>p_group) then raise exception 'Your store subscription is already assigned to another group'; end if;
 if exists(select 1 from public.group_subscription_entitlements where group_id=p_group and expires_at>now() and status in('active','grace','cancelled')) then raise exception 'This group already has an active subscription'; end if;
 if p_product not in('tracksy_group_monthly','tracksy_group_yearly') then raise exception 'Unknown product'; end if;
 update public.billing_purchase_intents set consumed_at=now() where purchaser_id=u and consumed_at is null and expires_at<=now();
 select id into i from public.billing_purchase_intents where purchaser_id=u and consumed_at is null and group_id=p_group and product_id=p_product;
 if i is not null then return i; end if;
 insert into public.billing_purchase_intents(purchaser_id,group_id,product_id) values(u,p_group,p_product) returning id into i;
 return i;
end $$;

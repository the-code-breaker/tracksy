-- Operator-issued access is separate from a store purchase. Existing RLS and
-- table grants allow only trusted backend/operators to issue entitlements.
alter table public.group_subscription_entitlements
  alter column purchase_id drop not null,
  add column complimentary_reason text,
  add constraint entitlement_source_required check (
    (purchase_id is not null and complimentary_reason is null)
    or (purchase_id is null and length(trim(complimentary_reason)) between 10 and 500
        and complimentary_reason is not null and not renews)
  );

-- A later verified store purchase replaces complimentary access normally.
create function private.normalize_entitlement_source() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.purchase_id is not null then new.complimentary_reason := null; end if;
  return new;
end $$;
revoke all on function private.normalize_entitlement_source() from public;
create trigger entitlement_source before insert or update
on public.group_subscription_entitlements for each row
execute function private.normalize_entitlement_source();

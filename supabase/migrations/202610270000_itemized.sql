create schema if not exists private;
revoke all on schema private from public;
-- Derive participant shares from each line's quantity weights. Negative discount lines
-- use the same deterministic allocation, with their signs applied after rounding.
create function private.itemized_shares(p_total bigint,p_items jsonb) returns jsonb language plpgsql set search_path='' as $$
declare item jsonb; allocations jsonb; amount bigint; denom numeric; r record; shares jsonb:='{}'; running numeric:=0; result jsonb; begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Add 1 to 100 items'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if length(trim(item->>'description')) not between 1 and 160 or item->>'description' is null then raise exception 'Item description required'; end if;
  if item->>'amount_minor' is null or (item->>'amount_minor') !~ '^-?\d+$' then raise exception 'Invalid item amount'; end if;
  amount:=(item->>'amount_minor')::bigint; if amount=0 or abs(amount::numeric)>999999999999 then raise exception 'Invalid item amount'; end if;
  running:=running+amount; allocations:=item->'allocations';
  if jsonb_typeof(allocations)<>'array' or jsonb_array_length(allocations) not between 1 and 100 then raise exception 'Assign each item'; end if;
  if (select count(distinct x->>'user_id') from jsonb_array_elements(allocations) x)<>jsonb_array_length(allocations) then raise exception 'Duplicate item participant'; end if;
  if exists(select 1 from jsonb_array_elements(allocations) x where x->>'value' is null or x->>'user_id' is null or x->>'value' !~ '^\d+$' or (x->>'value')::numeric not between 1 and 999999999999) then raise exception 'Invalid item quantity shares'; end if;
  select sum((x->>'value')::numeric) into denom from jsonb_array_elements(allocations) x;
  for r in with inputs as(select (x->>'user_id')::uuid uid,(x->>'value')::numeric weight from jsonb_array_elements(allocations) x),
  base as(select uid,floor(abs(amount::numeric)*weight/denom) value,mod(abs(amount::numeric)*weight,denom) rem from inputs),
  ranked as(select *,row_number() over(order by rem desc,uid) rank,abs(amount::numeric)-sum(value) over() leftover from base)
  select uid,(value+case when rank<=leftover then 1 else 0 end)*case when amount<0 then -1 else 1 end value from ranked loop
   shares:=jsonb_set(shares,array[r.uid::text],to_jsonb(coalesce((shares->>r.uid::text)::numeric,0)+r.value));
  end loop;
 end loop;
 if running<>p_total then raise exception 'Items must add up to the total'; end if;
 if exists(select 1 from jsonb_each_text(shares) x where x.value::numeric<0) then raise exception 'Discount exceeds participant item total'; end if;
 select jsonb_agg(jsonb_build_object('user_id',key,'value',value::bigint)) into result from jsonb_each_text(shares); return result;
end $$;
revoke execute on function private.itemized_shares(bigint,jsonb) from public,anon,authenticated;

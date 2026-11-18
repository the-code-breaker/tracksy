create or replace function public.create_expense(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); g uuid:=(p->>'group_id')::uuid; total bigint:=(p->>'amount_minor')::bigint;
 curr text:=p->>'currency'; method text:=p->>'split_method'; participants jsonb:=p->'participants'; n int; denom numeric; funded numeric; e uuid; prior uuid; before_record jsonb; row record; key uuid:=(p->>'idempotency_key')::uuid;
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
  if not exists(select 1 from public.group_members where group_id=g and user_id=row.uid::uuid and (active or (p->>'replaces_id' is not null and exists(select 1 from public.expense_splits old where old.expense_id=(p->>'replaces_id')::uuid and old.group_id=g and old.user_id=row.uid::uuid)))) then raise exception 'Participant is not an active member'; end if;
  if method<>'equal' and (row.val is null or row.val !~ '^\d+$' or row.val::numeric>999999999999) then raise exception 'Invalid split value'; end if;
 end loop;
 for row in select x->>'user_id' uid,x->>'amount_minor' val from jsonb_array_elements(p->'payers') x loop
  if not exists(select 1 from public.group_members where group_id=g and user_id=row.uid::uuid and (active or (p->>'replaces_id' is not null and exists(select 1 from public.expense_payers old where old.expense_id=(p->>'replaces_id')::uuid and old.group_id=g and old.user_id=row.uid::uuid)))) then raise exception 'Payer is not an active member'; end if;
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
  select to_jsonb(old_expense)||jsonb_build_object('participants',(select jsonb_agg(to_jsonb(s)) from public.expense_splits s where s.expense_id=old_expense.id),'payers',(select jsonb_agg(to_jsonb(f)) from public.expense_payers f where f.expense_id=old_expense.id)) into before_record from public.expenses old_expense where old_expense.id=(p->>'replaces_id')::uuid;
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
 perform private.audit(g,case when p->>'replaces_id' is null then 'expense_added' else 'expense_corrected' end,e,jsonb_build_object('description',p->>'description','currency',curr,'amount_minor',total,'previous_expense_id',p->>'replaces_id','before',before_record,'after',p-'idempotency_key'));
 insert into public.notifications(user_id,group_id,kind) select user_id,g,'expense_added' from public.group_members where group_id=g and active and user_id<>u;
 perform private.remember(key,'expense',p,e); return e;
end $$;



create index expenses_previous_version on public.expenses(replaces_id) where replaces_id is not null;
create function public.expense_versions(p_expense uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare g uuid;result jsonb;begin
 select group_id into g from public.expenses where id=p_expense;perform private.require_member(g);
 with recursive ancestors as(
  select e.id,e.replaces_id,0 depth from public.expenses e where e.id=p_expense
  union all select e.id,e.replaces_id,a.depth+1 from public.expenses e join ancestors a on e.id=a.replaces_id where e.group_id=g and a.depth<100
 ),root as(select id from ancestors order by depth desc limit 1),versions as(
  select e.*,0 depth from public.expenses e join root r on e.id=r.id
  union all select e.*,v.depth+1 from public.expenses e join versions v on e.replaces_id=v.id where e.group_id=g and v.depth<100
 )select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'description',v.description,'amount_minor',v.amount_minor,'currency',v.currency,'category',v.category,'expense_date',v.expense_date,'editor',p.display_name,'actor_id',v.created_by,'created_at',v.created_at,'reversed_at',v.reversed_at,'previous_id',v.replaces_id,'participants',(select coalesce(jsonb_agg(jsonb_build_object('user_id',s.user_id,'name',person.display_name,'amount_minor',s.amount_minor)),'[]') from public.expense_splits s join public.profiles person on person.id=s.user_id where s.expense_id=v.id)) order by v.depth desc),'[]') into result from versions v join public.profiles p on p.id=v.created_by;
 return result;
end $$;
revoke execute on function public.expense_versions(uuid) from public,anon;
grant execute on function public.expense_versions(uuid) to authenticated;

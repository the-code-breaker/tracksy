alter table public.custom_split_rules add column currency text;
update public.custom_split_rules r set currency=g.currency from public.groups g where g.id=r.group_id;
alter table public.custom_split_rules alter column currency set not null;
alter table public.custom_split_rules add constraint rule_currency_supported check(currency in ('INR','USD','EUR','GBP','JPY','KWD'));
create or replace function public.save_split_rule(p_group uuid,p_name text,p_method text,p_participants jsonb) returns uuid language plpgsql security definer set search_path='' as $$ declare r uuid; curr text; begin
 perform private.require_open(p_group); if not private.is_manager(p_group) or not public.has_group_feature(auth.uid(),p_group,'custom_rules') then raise exception 'Group Plus and manager required'; end if;
 if jsonb_typeof(p_participants)<>'array' or jsonb_array_length(p_participants) not between 1 and 100 then raise exception 'Participants required'; end if;
 if (select count(distinct x->>'user_id') from jsonb_array_elements(p_participants) x)<>jsonb_array_length(p_participants) then raise exception 'Duplicate rule participants'; end if;
 if exists(select 1 from jsonb_array_elements(p_participants) x where x->>'value' is null or (x->>'value') !~ '^\d+$' or (x->>'value')::numeric>999999999999 or not exists(select 1 from public.group_members m where m.group_id=p_group and m.user_id=(x->>'user_id')::uuid and m.active)) then raise exception 'Invalid rule participant'; end if;
 if p_method='percentage' and (select sum((x->>'value')::numeric) from jsonb_array_elements(p_participants) x)<>10000 then raise exception 'Rule percentages must total 10000 basis points'; end if;
 select currency into curr from public.groups where id=p_group;
 insert into public.custom_split_rules(group_id,name,split_method,participants,created_by,currency) values(p_group,trim(p_name),p_method,p_participants,auth.uid(),curr) returning id into r; return r;
end $$;
create function public.rule_from_expense(p_expense uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$ declare e public.expenses; participants jsonb; r uuid; begin
 select * into e from public.expenses where id=p_expense; perform private.require_open(e.group_id);
 if e.split_method='itemized' then raise exception 'Itemized rules are not supported'; end if;
 select jsonb_agg(jsonb_build_object('user_id',user_id,'value',input_value)) into participants from public.expense_splits where expense_id=e.id;
 r:=public.save_split_rule(e.group_id,p_name,e.split_method,participants); update public.custom_split_rules set currency=e.currency where id=r; return r;
end $$;
create function public.get_split_rule(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare rule public.custom_split_rules; begin
 select * into rule from public.custom_split_rules where id=p_id; perform private.require_open(rule.group_id);
 if not public.has_group_feature(auth.uid(),rule.group_id,'custom_rules') then raise exception 'Group Plus required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_array_elements(rule.participants) p where not exists(select 1 from public.group_members where group_id=rule.group_id and user_id=(p->>'user_id')::uuid and active)) then raise exception 'Rule includes an inactive member; save a revised rule'; end if;
 return to_jsonb(rule);
end $$;
revoke execute on function public.rule_from_expense(uuid,text),public.get_split_rule(uuid) from public,anon,authenticated;
grant execute on function public.rule_from_expense(uuid,text),public.get_split_rule(uuid) to authenticated;

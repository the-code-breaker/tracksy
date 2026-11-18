create function public.settlement_plan(p_group uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare curr text; debtor record; creditor record; credits jsonb; needed bigint; available bigint; amount bigint; result jsonb:='[]'; begin
 perform private.require_member(p_group); if not public.has_group_feature(auth.uid(),p_group,'settlement_plan') then raise exception 'Group Plus required' using errcode='42501'; end if;
 if not exists(select 1 from public.groups where id=p_group and simplified_settlements) then raise exception 'Simplified settlement suggestions are disabled'; end if;
 for curr in select distinct currency from public.financial_ledger_entries where group_id=p_group order by currency loop
  credits:='{}';
  for creditor in select user_id,sum(delta_minor)::bigint amount from public.financial_ledger_entries where group_id=p_group and currency=curr group by user_id having sum(delta_minor)>0 loop
   credits:=jsonb_set(credits,array[creditor.user_id::text],to_jsonb(creditor.amount));
  end loop;
  for debtor in select user_id,-sum(delta_minor)::bigint amount from public.financial_ledger_entries where group_id=p_group and currency=curr group by user_id having sum(delta_minor)<0 order by sum(delta_minor),user_id loop
   needed:=debtor.amount;
   for creditor in select key::uuid uid,value::bigint amount from jsonb_each_text(credits) order by value::bigint desc,key loop
    available:=(credits->>creditor.uid::text)::bigint; amount:=least(needed,available);
    if amount>0 then result:=result||jsonb_build_array(jsonb_build_object('currency',curr,'from_user',debtor.user_id,'to_user',creditor.uid,'amount_minor',amount)); credits:=jsonb_set(credits,array[creditor.uid::text],to_jsonb(available-amount)); needed:=needed-amount; end if;
    exit when needed=0;
   end loop;
  end loop;
 end loop;
 return result;
end $$;
create function public.set_settlement_simplification(p_group uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_open(p_group); if not private.is_manager(p_group) then raise exception 'Manager required'; end if;
 update public.groups set simplified_settlements=p_enabled,updated_at=now() where id=p_group; perform private.audit(p_group,'settlement_suggestions_changed',p_group,jsonb_build_object('enabled',p_enabled));
end $$;
revoke execute on function public.settlement_plan(uuid),public.set_settlement_simplification(uuid,boolean) from public,anon,authenticated;
grant execute on function public.settlement_plan(uuid),public.set_settlement_simplification(uuid,boolean) to authenticated;

alter table public.recurring_expenses add column anchor_day int not null default 1 check(anchor_day between 1 and 31);
alter table public.recurring_expense_runs add column error_code text;
create function public.create_recurring(p_expense uuid,p_start date,p_end date,p_interval int,p_auto boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.expenses; template jsonb; r uuid; begin
 select * into e from public.expenses where id=p_expense and reversed_at is null; perform private.require_open(e.group_id);
 if not private.is_manager(e.group_id) or not public.has_group_feature(auth.uid(),e.group_id,'recurring') then raise exception 'Group Plus and manager required' using errcode='42501'; end if;
 if p_start<current_date or (p_end is not null and p_end<p_start) then raise exception 'Invalid recurrence dates'; end if;
 if e.split_method='itemized' then raise exception 'Itemized recurrence is not supported'; end if;
 select jsonb_build_object('group_id',e.group_id,'description',e.description,'amount_minor',e.amount_minor,'currency',e.currency,'category',e.category,'split_method',e.split_method,'notes',e.notes,
 'participants',(select jsonb_agg(jsonb_build_object('user_id',user_id,'value',input_value)) from public.expense_splits where expense_id=e.id),
 'payers',(select jsonb_agg(jsonb_build_object('user_id',user_id,'amount_minor',amount_minor)) from public.expense_payers where expense_id=e.id)) into template;
 insert into public.recurring_expenses(group_id,created_by,template,next_date,end_date,interval_months,auto_post,anchor_day) values(e.group_id,auth.uid(),template,p_start,p_end,p_interval,p_auto,extract(day from p_start)::int) returning id into r;
 perform private.audit(e.group_id,'recurring_created',r,jsonb_build_object('auto_post',p_auto)); return r;
end $$;
create function public.stop_recurring(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ declare g uuid; begin
 select group_id into g from public.recurring_expenses where id=p_id; perform private.require_open(g); if not private.is_manager(g) then raise exception 'Manager required'; end if;
 update public.recurring_expenses set active=false where id=p_id; perform private.audit(g,'recurring_stopped',p_id);
end $$;
create function public.approve_recurring_run(p_run uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare run public.recurring_expense_runs; rule public.recurring_expenses; e uuid; begin
 select * into run from public.recurring_expense_runs where id=p_run for update; perform private.require_open(run.group_id);
 if not private.is_manager(run.group_id) or not public.has_group_feature(auth.uid(),run.group_id,'recurring') then raise exception 'Group Plus and manager required'; end if;
 if run.expense_id is not null then return run.expense_id; end if;
 if run.status<>'awaiting_approval' then raise exception 'Run is not awaiting approval'; end if;
 select * into rule from public.recurring_expenses where id=run.recurring_id;
 e:=public.create_expense(rule.template||jsonb_build_object('idempotency_key',run.id,'expense_date',run.scheduled_date));
 update public.recurring_expense_runs set expense_id=e,status='posted' where id=run.id; return e;
end $$;
create function public.run_recurring_batch() returns int language plpgsql security definer set search_path='' as $$
declare rule public.recurring_expenses; runid uuid; expense uuid; nextmonth date; lastday int; claimed int:=0; originalclaims text:=current_setting('request.jwt.claims',true); begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required'; end if;
 for rule in select * from public.recurring_expenses where active and next_date<=current_date and (end_date is null or next_date<=end_date) order by next_date limit 50 for update skip locked loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',rule.created_by,'role','authenticated')::text,true);
  if not public.has_group_feature(rule.created_by,rule.group_id,'recurring') or not private.is_manager(rule.group_id) or exists(select 1 from public.groups where id=rule.group_id and archived_at is not null) then
   perform set_config('request.jwt.claims',coalesce(originalclaims,'{}'),true); continue;
  end if;
  runid:=null;
  insert into public.recurring_expense_runs(group_id,recurring_id,scheduled_date) values(rule.group_id,rule.id,rule.next_date) on conflict do nothing returning id into runid;
  if runid is not null and rule.auto_post then
   begin
    expense:=public.create_expense(rule.template||jsonb_build_object('idempotency_key',runid,'expense_date',rule.next_date));
    update public.recurring_expense_runs set expense_id=expense,status='posted' where id=runid;
   exception when others then
    -- No partial financial writes survive the subtransaction. Manual review is required.
    update public.recurring_expense_runs set status='needs_review',error_code=sqlstate where id=runid;
   end;
  end if;
  nextmonth:=(date_trunc('month',rule.next_date)+make_interval(months=>rule.interval_months))::date;
  lastday:=extract(day from nextmonth+interval '1 month'-interval '1 day')::int;
  update public.recurring_expenses set next_date=nextmonth+least(rule.anchor_day,lastday)-1,active=(rule.end_date is null or nextmonth+least(rule.anchor_day,lastday)-1<=rule.end_date) where id=rule.id;
  claimed:=claimed+1; perform set_config('request.jwt.claims',coalesce(originalclaims,'{}'),true);
 end loop; return claimed;
end $$;
revoke execute on function public.create_recurring(uuid,date,date,int,boolean),public.stop_recurring(uuid),public.approve_recurring_run(uuid),public.run_recurring_batch() from public,anon,authenticated;
grant execute on function public.create_recurring(uuid,date,date,int,boolean),public.stop_recurring(uuid),public.approve_recurring_run(uuid) to authenticated;
grant execute on function public.run_recurring_batch() to service_role;

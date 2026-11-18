create function public.update_group(p_group uuid,p_name text,p_description text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_open(p_group); if not private.is_manager(p_group) then raise exception 'Manager required' using errcode='42501'; end if;
 update public.groups set name=trim(p_name),description=p_description,updated_at=now() where id=p_group; perform private.audit(p_group,'group_updated',p_group);
end $$;
create function public.attach_receipt(p_expense uuid,p_path text) returns uuid language plpgsql security definer set search_path='' as $$ declare g uuid; a uuid; begin
 select group_id into g from public.expenses where id=p_expense; perform private.require_open(g);
 if split_part(p_path,'/',1)<>g::text or split_part(p_path,'/',2)<>auth.uid()::text then raise exception 'Invalid receipt path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='receipts' and name=p_path) then raise exception 'Upload the receipt first'; end if;
 insert into public.expense_attachments(expense_id,group_id,storage_path,uploaded_by) values(p_expense,g,p_path,auth.uid()) returning id into a;
 perform private.audit(g,'receipt_attached',p_expense); return a;
end $$;
create function public.group_report(p_group uuid,p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform private.require_member(p_group); if not public.has_group_feature(auth.uid(),p_group,'reports') then raise exception 'Group Plus required' using errcode='42501'; end if;
 return jsonb_build_object('expenses',public.export_group(p_group,p_start,p_end),'analytics',public.group_analytics(p_group,p_start,p_end),'balances',(select coalesce(jsonb_agg(b),'[]') from public.group_balances(p_group) b),'generated_at',now(),'start',p_start,'end',p_end);
end $$;

create table private.push_deliveries (notification_id uuid not null references public.notifications, device_id uuid not null references public.user_devices, attempts int not null default 0, claimed_at timestamptz, delivered_at timestamptz, next_attempt_at timestamptz not null default now(), ticket_id text, last_error text, primary key(notification_id,device_id));
create function public.claim_push_batch() returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required'; end if;
 insert into private.push_deliveries(notification_id,device_id)
 select n.id,d.id from public.notifications n join public.user_devices d on d.user_id=n.user_id join public.notification_preferences p on p.user_id=n.user_id
 where n.created_at>now()-interval '1 day' and (n.kind='expense_added' and p.expenses or n.kind like 'settlement_%' and p.settlements) on conflict do nothing;
 with claimed as (
  select pd.notification_id,pd.device_id from private.push_deliveries pd join public.notifications n on n.id=pd.notification_id join public.user_preferences p on p.user_id=n.user_id
  where pd.delivered_at is null and pd.attempts<5 and pd.next_attempt_at<=now() and (pd.claimed_at is null or pd.claimed_at<now()-interval '5 minutes')
  -- Quiet hours are evaluated in the account’s configured IANA timezone.
  and (p.quiet_start is null or p.quiet_end is null or not(case when p.quiet_start>p.quiet_end then (now() at time zone p.timezone)::time>=p.quiet_start or (now() at time zone p.timezone)::time<p.quiet_end else (now() at time zone p.timezone)::time>=p.quiet_start and (now() at time zone p.timezone)::time<p.quiet_end end))
  order by pd.next_attempt_at limit 50 for update of pd skip locked
 ), updated as (update private.push_deliveries pd set claimed_at=now(),attempts=attempts+1 from claimed c where pd.notification_id=c.notification_id and pd.device_id=c.device_id returning pd.*)
 select coalesce(jsonb_agg(jsonb_build_object('notification_id',u.notification_id,'device_id',u.device_id,'token',d.push_token,'kind',n.kind,'group_id',n.group_id)),'[]') into result from updated u join public.user_devices d on d.id=u.device_id join public.notifications n on n.id=u.notification_id;
 return result;
end $$;
create function public.complete_push(p_notification uuid,p_device uuid,p_ticket text,p_error text) returns void language plpgsql security definer set search_path='' as $$ begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required'; end if;
 update private.push_deliveries set delivered_at=case when p_error is null then now() else null end,ticket_id=p_ticket,last_error=left(p_error,100),claimed_at=null,next_attempt_at=now()+interval '5 minutes'*attempts where notification_id=p_notification and device_id=p_device;
end $$;
revoke all on all tables in schema private from public,anon,authenticated;
revoke execute on function public.update_group(uuid,text,text),public.attach_receipt(uuid,text),public.group_report(uuid,date,date),public.claim_push_batch(),public.complete_push(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_group(uuid,text,text),public.attach_receipt(uuid,text),public.group_report(uuid,date,date) to authenticated;
grant execute on function public.claim_push_batch(),public.complete_push(uuid,uuid,text,text) to service_role;

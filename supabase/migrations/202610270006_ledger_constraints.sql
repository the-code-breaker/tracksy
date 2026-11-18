-- Financial integrity also holds for accidental one-sided service-role writes.
alter table public.settlements add constraint settlements_id_group_unique unique(id,group_id);
alter table public.financial_ledger_entries add constraint ledger_expense_group foreign key(expense_id,group_id) references public.expenses(id,group_id);
alter table public.financial_ledger_entries add constraint ledger_settlement_group foreign key(settlement_id,group_id) references public.settlements(id,group_id);
alter table public.financial_ledger_entries add constraint ledger_member foreign key(group_id,user_id) references public.group_members(group_id,user_id);
alter table public.financial_ledger_entries add constraint ledger_event_source check((expense_id is not null and entry_type in ('expense','expense_reversal')) or (settlement_id is not null and entry_type in ('settlement','settlement_reversal')));
alter table public.expense_splits add constraint splits_member foreign key(group_id,user_id) references public.group_members(group_id,user_id);
alter table public.expense_payers add constraint payers_member foreign key(group_id,user_id) references public.group_members(group_id,user_id);
alter table public.expense_participants add constraint participants_member foreign key(group_id,user_id) references public.group_members(group_id,user_id);
create function private.validate_ledger_event() returns trigger language plpgsql security definer set search_path='' as $$
declare expected_currency text; begin
 if new.expense_id is not null then
  select currency into expected_currency from public.expenses where id=new.expense_id;
  if exists(select 1 from public.financial_ledger_entries where expense_id=new.expense_id and entry_type=new.entry_type group by currency having sum(delta_minor)<>0) then raise exception 'Expense ledger event must sum to zero'; end if;
 else
  select currency into expected_currency from public.settlements where id=new.settlement_id;
  if exists(select 1 from public.financial_ledger_entries where settlement_id=new.settlement_id and entry_type=new.entry_type group by currency having sum(delta_minor)<>0) then raise exception 'Settlement ledger event must sum to zero'; end if;
 end if;
 if new.currency<>expected_currency then raise exception 'Ledger currency must match source'; end if;
 return null;
end $$;
create constraint trigger ledger_zero_sum after insert on public.financial_ledger_entries deferrable initially deferred for each row execute function private.validate_ledger_event();
revoke execute on function private.validate_ledger_event() from public,anon,authenticated;
create index settlements_group_created on public.settlements(group_id,created_at desc,id);
create index invitations_group_created on public.group_invitations(group_id,created_at desc);
create index recurring_due on public.recurring_expenses(next_date) where active;
create index billing_group on public.billing_purchases(group_id);

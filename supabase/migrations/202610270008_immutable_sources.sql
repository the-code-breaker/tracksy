create function private.protect_expense_source() returns trigger language plpgsql set search_path='' as $$ begin
 if (to_jsonb(old)-array['reversed_at','version','updated_at'])<>(to_jsonb(new)-array['reversed_at','version','updated_at']) then raise exception 'Expense corrections must create a replacement record'; end if;
 return new;
end $$;
create trigger expense_source_immutable before update on public.expenses for each row execute function private.protect_expense_source();
create function private.protect_purchase_mapping() returns trigger language plpgsql set search_path='' as $$ begin
 if old.purchaser_id<>new.purchaser_id or old.group_id<>new.group_id or old.provider<>new.provider or old.original_transaction_id<>new.original_transaction_id then raise exception 'Purchase beneficiary mapping is immutable'; end if; return new;
end $$;
create trigger purchase_mapping_immutable before update on public.billing_purchases for each row execute function private.protect_purchase_mapping();
revoke execute on function private.protect_expense_source(),private.protect_purchase_mapping() from public,anon,authenticated;

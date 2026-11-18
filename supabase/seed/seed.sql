-- Intentionally no auth bypass or fabricated financial records in production seeds.
-- Integration fixtures create verified users and call the same RPCs as the app.
insert into public.product_flags(key,enabled) values('receipt_scan',false),('assistant',false) on conflict do nothing;

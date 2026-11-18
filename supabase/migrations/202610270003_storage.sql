insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('receipts','receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Object names: <group uuid>/<uploader uuid>/<random uuid>.<extension>.
create policy receipt_read on storage.objects for select to authenticated using(bucket_id='receipts' and public.is_group_member(((storage.foldername(name))[1])::uuid));
create policy receipt_upload on storage.objects for insert to authenticated with check(bucket_id='receipts' and public.is_group_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2]=auth.uid()::text);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
-- Subscribe only to tables with member-based RLS. Ledger mutations trigger client invalidation.
alter publication supabase_realtime add table public.expenses,public.settlements,public.group_members,public.group_subscription_entitlements;

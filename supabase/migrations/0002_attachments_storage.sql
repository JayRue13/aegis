-- Private storage bucket for chat images. Files live under
-- <user id>/<conversation id>/..., and each user can only touch their own folder.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments own folder read" on storage.objects;
drop policy if exists "attachments own folder write" on storage.objects;
drop policy if exists "attachments own folder update" on storage.objects;
drop policy if exists "attachments own folder delete" on storage.objects;

create policy "attachments own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments own folder write" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

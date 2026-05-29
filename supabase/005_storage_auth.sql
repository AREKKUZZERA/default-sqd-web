-- DEFAULT SQD WEB / authenticated storage policies
-- Optional. Run after 003_storage.sql if you want the avatars bucket locked to logged-in users.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_read_public" on storage.objects;
drop policy if exists "avatars_insert_public" on storage.objects;
drop policy if exists "avatars_update_public" on storage.objects;
drop policy if exists "avatars_read_authenticated" on storage.objects;
drop policy if exists "avatars_insert_authenticated_own_folder" on storage.objects;
drop policy if exists "avatars_update_authenticated_own_folder" on storage.objects;
drop policy if exists "avatars_delete_authenticated_own_folder" on storage.objects;

create policy "avatars_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

-- Store files under a folder named as auth.uid(), for example:
-- avatars/<auth.uid()>/avatar.png
create policy "avatars_insert_authenticated_own_folder"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_authenticated_own_folder"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_authenticated_own_folder"
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

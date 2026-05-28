-- Optional storage bucket for future avatar/banner uploads.
-- The current frontend is already ready to store avatar_image/banner_image URLs in profiles,
-- but file upload UI is not wired yet.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public"
on storage.objects for select
using (bucket_id = 'avatars');

-- Demo policy: lets the public frontend upload images to the avatars bucket.
-- Replace with auth.uid() checks before a real production release.
drop policy if exists "avatars_insert_public" on storage.objects;
create policy "avatars_insert_public"
on storage.objects for insert
with check (bucket_id = 'avatars');

drop policy if exists "avatars_update_public" on storage.objects;
create policy "avatars_update_public"
on storage.objects for update
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');

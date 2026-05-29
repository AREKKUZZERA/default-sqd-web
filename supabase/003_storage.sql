-- Optional storage bucket for avatar/banner uploads.
-- Release mode keeps writes authenticated. Run 005_storage_auth.sql after this file.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Public read is OK only if profile images are intended to be visible to logged-in users/public URLs.
-- Authenticated write policies are defined in 005_storage_auth.sql.
drop policy if exists "avatars_insert_public" on storage.objects;
drop policy if exists "avatars_update_public" on storage.objects;

drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public"
on storage.objects for select
using (bucket_id = 'avatars');

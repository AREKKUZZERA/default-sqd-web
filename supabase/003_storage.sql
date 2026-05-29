-- Optional storage bucket for avatar/banner uploads.
-- Release mode keeps writes authenticated. Run 005_storage_auth.sql after this file.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = excluded.public;

-- Private bucket: clients read through authenticated policies and signed URLs.
-- Authenticated write policies are defined in 005_storage_auth.sql.
drop policy if exists "avatars_insert_public" on storage.objects;
drop policy if exists "avatars_update_public" on storage.objects;

drop policy if exists "avatars_read_public" on storage.objects;
-- The bucket is private in release mode. Authenticated read/write policies live in 005_storage_auth.sql.

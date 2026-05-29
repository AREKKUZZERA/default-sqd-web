-- DEFAULT SQD WEB / Closed Auth migration
-- Run after 001_schema.sql. Do not seed demo data for release builds.
-- This migration closes public table access and allows reads/writes only for authenticated users.
-- Passwords are never stored in this repository. Create users in Supabase Dashboard -> Authentication -> Users.

create extension if not exists pgcrypto;

-- Profiles still use text ids so existing demo rows keep working.
-- Real account profiles use auth.users.id::text as profiles.id.
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_reactions enable row level security;

-- Drop old public/demo policies.
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_public" on public.profiles;
drop policy if exists "profiles_update_public" on public.profiles;
drop policy if exists "posts_select_public" on public.posts;
drop policy if exists "posts_insert_public" on public.posts;
drop policy if exists "posts_update_public" on public.posts;
drop policy if exists "posts_delete_public" on public.posts;
drop policy if exists "comments_select_public" on public.comments;
drop policy if exists "comments_insert_public" on public.comments;
drop policy if exists "comments_update_public" on public.comments;
drop policy if exists "comments_delete_public" on public.comments;
drop policy if exists "post_reactions_select_public" on public.post_reactions;
drop policy if exists "post_reactions_insert_public" on public.post_reactions;
drop policy if exists "post_reactions_delete_public" on public.post_reactions;

-- Idempotent secure policies.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid()::text);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid()::text)
with check (id = auth.uid()::text);

drop policy if exists "posts_select_authenticated" on public.posts;
create policy "posts_select_authenticated"
on public.posts
for select
to authenticated
using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
on public.posts
for insert
to authenticated
with check (owner_id = auth.uid()::text);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
on public.posts
for update
to authenticated
using (owner_id = auth.uid()::text)
with check (owner_id = auth.uid()::text);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
on public.posts
for delete
to authenticated
using (owner_id = auth.uid()::text);

drop policy if exists "comments_select_authenticated" on public.comments;
create policy "comments_select_authenticated"
on public.comments
for select
to authenticated
using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
on public.comments
for insert
to authenticated
with check (author_id = auth.uid()::text);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
on public.comments
for update
to authenticated
using (author_id = auth.uid()::text)
with check (author_id = auth.uid()::text);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
on public.comments
for delete
to authenticated
using (author_id = auth.uid()::text);

drop policy if exists "post_reactions_select_authenticated" on public.post_reactions;
create policy "post_reactions_select_authenticated"
on public.post_reactions
for select
to authenticated
using (true);

drop policy if exists "post_reactions_insert_own" on public.post_reactions;
create policy "post_reactions_insert_own"
on public.post_reactions
for insert
to authenticated
with check (user_id = auth.uid()::text);

drop policy if exists "post_reactions_delete_own" on public.post_reactions;
create policy "post_reactions_delete_own"
on public.post_reactions
for delete
to authenticated
using (user_id = auth.uid()::text);

drop policy if exists "post_reactions_update_own" on public.post_reactions;
create policy "post_reactions_update_own"
on public.post_reactions
for update
to authenticated
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

-- Auto-create a profile when an admin creates a Supabase Auth user.
-- The frontend also has a defensive ensureProfileForSession() call for existing accounts.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_user_id text;
  final_user_id text;
  display_name text;
  initials text;
begin
  base_user_id := lower(
    regexp_replace(
      coalesce(new.raw_user_meta_data->>'user_id', split_part(new.email, '@', 1), 'user'),
      '[^a-z0-9_-]+',
      '_',
      'g'
    )
  );
  base_user_id := trim(both '_' from base_user_id);

  if base_user_id = '' then
    base_user_id := 'user';
  end if;

  final_user_id := left(base_user_id, 28);

  if exists (select 1 from public.profiles where user_id = final_user_id and id <> new.id::text) then
    final_user_id := left(base_user_id, 21) || '_' || left(new.id::text, 6);
  end if;

  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    final_user_id
  );

  initials := upper(left(regexp_replace(display_name, '[^[:alnum:]]+', '', 'g'), 2));
  if initials = '' then
    initials := 'SQ';
  end if;

  insert into public.profiles (id, user_id, name, role, avatar, status, bio)
  values (
    new.id::text,
    final_user_id,
    display_name,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'Member'),
    initials,
    'online',
    'Новый участник закрытого пространства DEFAULT SQUAD.'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Make sure anon cannot call table APIs through old grants without RLS policies.
revoke insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.posts from anon;
revoke insert, update, delete on public.comments from anon;
revoke insert, update, delete on public.post_reactions from anon;

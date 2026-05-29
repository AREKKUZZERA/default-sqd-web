-- DEFAULT SQD WEB / profile presence
-- Adds durable last-seen timestamps for Realtime Presence fallback labels.

alter table public.profiles
  add column if not exists last_seen_at timestamptz not null default now();

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

grant update (last_seen_at) on public.profiles to authenticated;

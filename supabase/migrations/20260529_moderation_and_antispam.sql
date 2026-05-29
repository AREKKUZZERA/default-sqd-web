-- Moderation, blocking and anti-spam layer for default-sqd-web / SQD.
-- Apply with: supabase db push
-- This migration is intentionally additive: it does not remove existing tables.

create extension if not exists pgcrypto;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('warning', 'mute', 'ban', 'unmute', 'unban', 'note')),
  reason text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_safety_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  warnings_count integer not null default 0 check (warnings_count >= 0),
  muted_until timestamptz,
  banned_until timestamptz,
  ban_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  message_id uuid references public.direct_messages(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  constraint moderation_reports_has_target check (
    target_id is not null or post_id is not null or comment_id is not null or message_id is not null
  )
);

create table if not exists public.content_rate_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('post', 'comment', 'message', 'profile_update', 'reaction')),
  content_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_rate_events_user_action_created
  on public.content_rate_events(user_id, action, created_at desc);

create index if not exists idx_content_rate_events_user_hash_created
  on public.content_rate_events(user_id, content_hash, created_at desc)
  where content_hash is not null;

create index if not exists idx_moderation_actions_target_created
  on public.moderation_actions(target_id, created_at desc);

create index if not exists idx_moderation_reports_status_created
  on public.moderation_reports(status, created_at desc);

alter table public.user_blocks enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.user_safety_state enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.content_rate_events enable row level security;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_moderator(check_user_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id
      and lower(coalesce(role, '')) in ('admin', 'administrator', 'moderator', 'mod')
  );
$$;

create or replace function public.normalize_moderation_text(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.content_spam_score(value text)
returns integer
language plpgsql
immutable
as $$
declare
  normalized text := public.normalize_moderation_text(value);
  score integer := 0;
  url_count integer := 0;
begin
  if length(normalized) = 0 then
    return 100;
  end if;

  if length(normalized) < 3 then
    score := score + 25;
  end if;

  select count(*) into url_count
  from regexp_matches(normalized, '(https?://|www\.)', 'g');

  if url_count >= 2 then
    score := score + 35;
  elsif url_count = 1 then
    score := score + 10;
  end if;

  if normalized ~ '(.)\1{9,}' then
    score := score + 35;
  end if;

  if normalized ~ '(.){1,4}\1{5,}' then
    score := score + 25;
  end if;

  if normalized ~ '(telegram|t\.me/|casino|казино|ставки|bet|viagra|crypto pump|airdrop)' then
    score := score + 35;
  end if;

  return score;
end;
$$;

create or replace function public.assert_user_can_write(action_name text, body text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.current_profile_id();
  state public.user_safety_state%rowtype;
  limit_count integer := 0;
  duplicate_count integer := 0;
  content_hash text := encode(digest(public.normalize_moderation_text(body), 'sha256'), 'hex');
  spam_score integer := public.content_spam_score(body);
  window_minutes integer := 10;
  max_events integer := case action_name
    when 'post' then 5
    when 'comment' then 12
    when 'message' then 20
    when 'profile_update' then 8
    when 'reaction' then 80
    else 10
  end;
begin
  if uid is null then
    raise exception 'Требуется вход в аккаунт.' using errcode = '28000';
  end if;

  select * into state from public.user_safety_state where user_id = uid;

  if state.banned_until is not null and state.banned_until > now() then
    raise exception 'Аккаунт заблокирован до %. Причина: %', state.banned_until, coalesce(state.ban_reason, 'нарушение правил') using errcode = '42501';
  end if;

  if state.muted_until is not null and state.muted_until > now() then
    raise exception 'Отправка временно ограничена до %.', state.muted_until using errcode = '42501';
  end if;

  if spam_score >= 70 then
    insert into public.moderation_actions(target_id, action, reason)
    values (uid, 'note', 'Blocked by spam score: ' || spam_score);
    raise exception 'Сообщение похоже на спам. Измените текст и попробуйте снова.' using errcode = '22023';
  end if;

  select count(*) into limit_count
  from public.content_rate_events
  where user_id = uid
    and action = action_name
    and created_at > now() - make_interval(mins => window_minutes);

  if limit_count >= max_events then
    insert into public.moderation_actions(target_id, action, reason, expires_at)
    values (uid, 'note', 'Rate limit exceeded for ' || action_name, now() + interval '15 minutes');
    raise exception 'Слишком много действий подряд. Подождите немного и попробуйте снова.' using errcode = '54000';
  end if;

  if length(public.normalize_moderation_text(body)) > 0 then
    select count(*) into duplicate_count
    from public.content_rate_events
    where user_id = uid
      and content_hash = content_hash
      and created_at > now() - interval '15 minutes';

    if duplicate_count >= 2 then
      raise exception 'Похоже на повторяющийся спам. Измените текст.' using errcode = '22023';
    end if;
  end if;

  insert into public.content_rate_events(user_id, action, content_hash)
  values (uid, action_name, nullif(content_hash, encode(digest('', 'sha256'), 'hex')));
end;
$$;

create or replace function public.create_post_safe(body text, tag_list text[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.current_profile_id();
begin
  perform public.assert_user_can_write('post', body);
  insert into public.posts(owner_id, text, tags)
  values (uid, trim(body), coalesce(tag_list, '{}'));
end;
$$;

create or replace function public.create_comment_safe(target_post_id uuid, body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.current_profile_id();
  post_owner uuid;
begin
  perform public.assert_user_can_write('comment', body);
  select owner_id into post_owner from public.posts where id = target_post_id;

  if post_owner is null then
    raise exception 'Пост не найден.' using errcode = '02000';
  end if;

  if exists (
    select 1 from public.user_blocks
    where (blocker_id = post_owner and blocked_id = uid)
       or (blocker_id = uid and blocked_id = post_owner)
  ) then
    raise exception 'Взаимодействие с этим пользователем ограничено.' using errcode = '42501';
  end if;

  insert into public.comments(post_id, author_id, text)
  values (target_post_id, uid, trim(body));
end;
$$;

create or replace function public.send_direct_message_safe(target_conversation_id uuid, body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.current_profile_id();
  blocked boolean := false;
begin
  perform public.assert_user_can_write('message', body);

  select exists (
    select 1
    from public.direct_conversation_members own_member
    join public.direct_conversation_members other_member
      on other_member.conversation_id = own_member.conversation_id
     and other_member.user_id <> own_member.user_id
    join public.user_blocks b
      on (b.blocker_id = own_member.user_id and b.blocked_id = other_member.user_id)
      or (b.blocker_id = other_member.user_id and b.blocked_id = own_member.user_id)
    where own_member.conversation_id = target_conversation_id
      and own_member.user_id = uid
  ) into blocked;

  if blocked then
    raise exception 'Сообщения этому пользователю ограничены.' using errcode = '42501';
  end if;

  insert into public.direct_messages(conversation_id, sender_id, text)
  values (target_conversation_id, uid, trim(body));
end;
$$;

create or replace function public.block_user(target_user_id uuid, reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.current_profile_id();
begin
  if uid is null then
    raise exception 'Требуется вход в аккаунт.' using errcode = '28000';
  end if;

  if uid = target_user_id then
    raise exception 'Нельзя заблокировать самого себя.' using errcode = '22023';
  end if;

  insert into public.user_blocks(blocker_id, blocked_id, reason)
  values (uid, target_user_id, coalesce(reason, ''))
  on conflict (blocker_id, blocked_id) do update
    set reason = excluded.reason,
        created_at = now();
end;
$$;

create or replace function public.unblock_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_blocks
  where blocker_id = public.current_profile_id()
    and blocked_id = target_user_id;
end;
$$;

create or replace function public.report_content(target_user_id uuid default null, target_post_id uuid default null, target_comment_id uuid default null, target_message_id uuid default null, report_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.current_profile_id();
begin
  if uid is null then
    raise exception 'Требуется вход в аккаунт.' using errcode = '28000';
  end if;

  insert into public.moderation_reports(reporter_id, target_id, post_id, comment_id, message_id, reason)
  values (uid, target_user_id, target_post_id, target_comment_id, target_message_id, trim(report_reason));
end;
$$;

create or replace function public.apply_moderation_action(target_user_id uuid, action_name text, reason text default '', expires_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_profile_id();
begin
  if not public.is_moderator(actor) then
    raise exception 'Недостаточно прав модератора.' using errcode = '42501';
  end if;

  insert into public.moderation_actions(actor_id, target_id, action, reason, expires_at)
  values (actor, target_user_id, action_name, trim(reason), expires_at);

  insert into public.user_safety_state(user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  if action_name = 'warning' then
    update public.user_safety_state
    set warnings_count = warnings_count + 1,
        updated_at = now()
    where user_id = target_user_id;
  elsif action_name = 'mute' then
    update public.user_safety_state
    set muted_until = coalesce(expires_at, now() + interval '24 hours'),
        updated_at = now()
    where user_id = target_user_id;
  elsif action_name = 'ban' then
    update public.user_safety_state
    set banned_until = coalesce(expires_at, now() + interval '100 years'),
        ban_reason = trim(reason),
        updated_at = now()
    where user_id = target_user_id;
  elsif action_name = 'unmute' then
    update public.user_safety_state
    set muted_until = null,
        updated_at = now()
    where user_id = target_user_id;
  elsif action_name = 'unban' then
    update public.user_safety_state
    set banned_until = null,
        ban_reason = null,
        updated_at = now()
    where user_id = target_user_id;
  end if;
end;
$$;

-- RLS policies. Names are dropped first to make the migration rerunnable.
drop policy if exists user_blocks_select_own on public.user_blocks;
drop policy if exists user_blocks_insert_own on public.user_blocks;
drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
  for select using (blocker_id = public.current_profile_id() or blocked_id = public.current_profile_id() or public.is_moderator());
create policy user_blocks_insert_own on public.user_blocks
  for insert with check (blocker_id = public.current_profile_id());
create policy user_blocks_delete_own on public.user_blocks
  for delete using (blocker_id = public.current_profile_id() or public.is_moderator());

drop policy if exists moderation_reports_insert_own on public.moderation_reports;
drop policy if exists moderation_reports_select_mod on public.moderation_reports;
create policy moderation_reports_insert_own on public.moderation_reports
  for insert with check (reporter_id = public.current_profile_id());
create policy moderation_reports_select_mod on public.moderation_reports
  for select using (public.is_moderator() or reporter_id = public.current_profile_id());

drop policy if exists moderation_actions_select_mod_or_target on public.moderation_actions;
create policy moderation_actions_select_mod_or_target on public.moderation_actions
  for select using (public.is_moderator() or target_id = public.current_profile_id());

drop policy if exists user_safety_state_select_own_or_mod on public.user_safety_state;
create policy user_safety_state_select_own_or_mod on public.user_safety_state
  for select using (public.is_moderator() or user_id = public.current_profile_id());

drop policy if exists content_rate_events_select_mod on public.content_rate_events;
create policy content_rate_events_select_mod on public.content_rate_events
  for select using (public.is_moderator());

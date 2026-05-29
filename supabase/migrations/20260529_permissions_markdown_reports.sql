-- Permission badges, full markdown-sized posts and richer moderation report data.
-- Apply after 20260529_moderation_and_antispam.sql and 20260529_moderation_ui.sql.

alter table public.profiles
  add column if not exists permissions text[] not null default '{}';

alter table public.profiles
  alter column role set default 'Member';

update public.profiles
set role = 'Member'
where role is null or btrim(role) = '';

with normalized_permissions as (
  select
    source.id,
    array_agg(distinct source.permission) filter (where source.permission is not null) as permissions
  from (
    select
      p.id,
      case lower(btrim(value))
        when 'owner' then 'owner'
        when 'creator' then 'creator'
        when 'admin' then 'admin'
        when 'administrator' then 'admin'
        when 'moderator' then 'moderator'
        when 'mod' then 'moderator'
        else null
      end as permission
    from public.profiles p
    cross join lateral unnest(coalesce(p.permissions, '{}'::text[])) as value

    union all

    select
      p.id,
      case lower(btrim(coalesce(p.role, '')))
        when 'owner' then 'owner'
        when 'creator' then 'creator'
        when 'admin' then 'admin'
        when 'administrator' then 'admin'
        when 'moderator' then 'moderator'
        when 'mod' then 'moderator'
        else null
      end as permission
    from public.profiles p
  ) source
  group by source.id
)
update public.profiles p
set permissions = coalesce(normalized_permissions.permissions, '{}'::text[])
from normalized_permissions
where p.id = normalized_permissions.id;

update public.profiles
set role = 'Member'
where lower(btrim(coalesce(role, ''))) in ('owner', 'creator', 'admin', 'administrator', 'moderator', 'mod');

alter table public.profiles
  alter column role set not null,
  alter column permissions set default '{}',
  alter column permissions set not null;

alter table public.profiles
  drop constraint if exists profiles_permissions_known;

alter table public.profiles
  add constraint profiles_permissions_known
  check (permissions <@ array['owner', 'creator', 'admin', 'moderator']::text[]);

alter table public.posts
  drop constraint if exists posts_text_check;

alter table public.posts
  add constraint posts_text_check
  check (char_length(trim(text)) > 0 and char_length(text) <= 4000);

create or replace function public.current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where id = auth.uid()::text limit 1;
$$;

create or replace function public.is_moderator(check_user_id text default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and (
        lower(coalesce(role, '')) in ('admin', 'administrator', 'moderator', 'mod', 'owner', 'creator')
        or coalesce(permissions, '{}'::text[]) && array['owner', 'creator', 'admin', 'moderator']::text[]
      )
  );
$$;

create or replace function public.create_post_safe(body text, tag_list text[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.current_profile_id();
begin
  if char_length(trim(coalesce(body, ''))) = 0 then
    raise exception 'Пост не может быть пустым.' using errcode = '22023';
  end if;

  if char_length(body) > 4000 then
    raise exception 'Пост не может быть длиннее 4000 символов.' using errcode = '22023';
  end if;

  perform public.assert_user_can_write('post', body);

  insert into public.posts(owner_id, text, tags)
  values (uid, trim(body), coalesce(tag_list, '{}'));
end;
$$;

drop function if exists public.create_comment_safe(uuid, text);

create or replace function public.create_comment_safe(target_post_id bigint, body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.current_profile_id();
  post_owner text;
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

drop function if exists public.list_moderation_reports();

create or replace function public.list_moderation_reports()
returns table (
  id uuid,
  reporter_id text,
  reporter_name text,
  reporter_user_id text,
  target_id text,
  target_name text,
  target_user_id text,
  target_role text,
  target_permissions text[],
  post_id text,
  comment_id text,
  message_id text,
  content_type text,
  content_text text,
  content_author_id text,
  content_author_name text,
  content_author_user_id text,
  content_created_at timestamptz,
  reason text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.reporter_id,
    reporter.name as reporter_name,
    reporter.user_id as reporter_user_id,
    coalesce(r.target_id, p.owner_id, c.author_id, dm.sender_id) as target_id,
    target.name as target_name,
    target.user_id as target_user_id,
    target.role as target_role,
    coalesce(target.permissions, '{}'::text[]) as target_permissions,
    r.post_id::text,
    r.comment_id::text,
    r.message_id::text,
    case
      when r.post_id is not null then 'post'
      when r.comment_id is not null then 'comment'
      when r.message_id is not null then 'message'
      else 'user'
    end as content_type,
    coalesce(p.text, c.text, dm.text, '') as content_text,
    coalesce(p.owner_id, c.author_id, dm.sender_id) as content_author_id,
    content_author.name as content_author_name,
    content_author.user_id as content_author_user_id,
    coalesce(p.created_at, c.created_at, dm.created_at) as content_created_at,
    r.reason,
    r.status,
    r.created_at
  from public.moderation_reports r
  left join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.direct_messages dm on dm.id = r.message_id
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.profiles target on target.id = coalesce(r.target_id, p.owner_id, c.author_id, dm.sender_id)
  left join public.profiles content_author on content_author.id = coalesce(p.owner_id, c.author_id, dm.sender_id)
  where public.is_moderator()
  order by
    case when r.status in ('open', 'reviewing') then 0 else 1 end,
    r.created_at desc
  limit 200;
$$;

create or replace function public.set_report_status(report_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Недостаточно прав модератора.' using errcode = '42501';
  end if;

  if next_status not in ('open', 'reviewing', 'resolved', 'rejected') then
    raise exception 'Недопустимый статус жалобы.' using errcode = '22023';
  end if;

  update public.moderation_reports
  set status = next_status
  where id = report_id;
end;
$$;

grant execute on function public.create_post_safe(text, text[]) to authenticated;
grant execute on function public.create_comment_safe(bigint, text) to authenticated;
grant execute on function public.list_moderation_reports() to authenticated;
grant execute on function public.set_report_status(uuid, text) to authenticated;

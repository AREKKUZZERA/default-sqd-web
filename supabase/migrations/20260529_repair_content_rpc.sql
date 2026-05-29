-- Repair content write RPC signatures so Supabase/PostgREST matches frontend calls.
-- Frontend calls:
--   create_post_safe({ body, tag_list })
--   create_comment_safe({ body, target_post_id })
--   send_direct_message_safe({ body, target_conversation_id })

-- Remove broken/experimental overloads. PostgREST can fail to resolve overloaded RPCs.
drop function if exists public.create_post_safe(jsonb);
drop function if exists public.create_post_safe(text);
drop function if exists public.create_post_safe(text, text[]);
drop function if exists public.create_post_safe(text, jsonb);
drop function if exists public.create_comment_safe(jsonb);
drop function if exists public.create_comment_safe(text, bigint);
drop function if exists public.create_comment_safe(bigint, text);
drop function if exists public.send_direct_message_safe(jsonb);
drop function if exists public.send_direct_message_safe(text, uuid);
drop function if exists public.send_direct_message_safe(uuid, text);

create or replace function public.create_post_safe(body text, tag_list text[] default '{}'::text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.current_profile_id();
begin
  if uid is null then
    raise exception 'Auth required' using errcode = '28000';
  end if;

  if char_length(trim(coalesce(body, ''))) = 0 then
    raise exception 'Post body is empty' using errcode = '22023';
  end if;

  if char_length(body) > 4000 then
    raise exception 'Post body is too long' using errcode = '22023';
  end if;

  perform public.assert_user_can_write('post', body);

  insert into public.posts(owner_id, text, tags)
  values (uid, trim(body), coalesce(tag_list, '{}'::text[]));
end;
$$;

create or replace function public.create_comment_safe(body text, target_post_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.current_profile_id();
  post_owner text;
begin
  if uid is null then
    raise exception 'Auth required' using errcode = '28000';
  end if;

  if target_post_id is null then
    raise exception 'Post id is required' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(body, ''))) = 0 then
    raise exception 'Comment body is empty' using errcode = '22023';
  end if;

  if char_length(body) > 280 then
    raise exception 'Comment body is too long' using errcode = '22023';
  end if;

  select owner_id into post_owner
  from public.posts
  where id = target_post_id;

  if post_owner is null then
    raise exception 'Post not found' using errcode = '02000';
  end if;

  perform public.assert_user_can_write('comment', body);

  insert into public.comments(post_id, author_id, text)
  values (target_post_id, uid, trim(body));
end;
$$;

create or replace function public.send_direct_message_safe(body text, target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.current_profile_id();
begin
  if uid is null then
    raise exception 'Auth required' using errcode = '28000';
  end if;

  if target_conversation_id is null then
    raise exception 'Conversation id is required' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(body, ''))) = 0 then
    raise exception 'Message body is empty' using errcode = '22023';
  end if;

  if char_length(body) > 1000 then
    raise exception 'Message body is too long' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.direct_conversation_members
    where conversation_id = target_conversation_id
      and user_id = uid
  ) then
    raise exception 'Conversation access denied' using errcode = '42501';
  end if;

  perform public.assert_user_can_write('message', body);

  insert into public.direct_messages(conversation_id, sender_id, text)
  values (target_conversation_id, uid, trim(body));
end;
$$;

grant execute on function public.create_post_safe(text, text[]) to authenticated;
grant execute on function public.create_comment_safe(text, bigint) to authenticated;
grant execute on function public.send_direct_message_safe(text, uuid) to authenticated;

notify pgrst, 'reload schema';

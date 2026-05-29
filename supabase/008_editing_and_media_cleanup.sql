alter table public.posts
drop column if exists media_attached;

alter table public.comments
add column if not exists updated_at timestamptz not null default now();

alter table public.direct_messages
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

drop trigger if exists direct_messages_set_updated_at on public.direct_messages;
create trigger direct_messages_set_updated_at
before update on public.direct_messages
for each row execute function public.set_updated_at();

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
on public.comments
for update
to authenticated
using (author_id = auth.uid()::text)
with check (author_id = auth.uid()::text);

drop policy if exists "direct_messages_update_own" on public.direct_messages;
create policy "direct_messages_update_own"
on public.direct_messages
for update
to authenticated
using (
  sender_id = auth.uid()::text
  and public.is_conversation_member(conversation_id, auth.uid()::text)
)
with check (
  sender_id = auth.uid()::text
  and public.is_conversation_member(conversation_id, auth.uid()::text)
);


drop policy if exists "direct_messages_delete_own" on public.direct_messages;
create policy "direct_messages_delete_own"
on public.direct_messages
for delete
to authenticated
using (
  sender_id = auth.uid()::text
  and public.is_conversation_member(conversation_id, auth.uid()::text)
);

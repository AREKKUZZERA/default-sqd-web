-- UI helpers for the moderation dashboard.
-- Apply after 20260529_moderation_and_antispam.sql.

create or replace function public.list_moderation_reports()
returns table (
  id uuid,
  reporter_id text,
  reporter_name text,
  target_id text,
  target_name text,
  post_id bigint,
  comment_id bigint,
  message_id bigint,
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
    r.target_id,
    target.name as target_name,
    r.post_id,
    r.comment_id,
    r.message_id,
    r.reason,
    r.status,
    r.created_at
  from public.moderation_reports r
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.profiles target on target.id = r.target_id
  where public.is_moderator()
  order by r.created_at desc
  limit 100;
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

grant execute on function public.list_moderation_reports() to authenticated;
grant execute on function public.set_report_status(uuid, text) to authenticated;

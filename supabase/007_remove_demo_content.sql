-- DEFAULT SQD WEB / Remove old demo and fake content
-- Safe to run after 006_release_features.sql.
-- Deletes only legacy demo profiles whose IDs were hardcoded in early mock/seed data.
-- Posts, comments and reactions owned by those profiles are removed by ON DELETE CASCADE.

delete from public.profiles
where id in (
  'user_mira_vale',
  'user_nika_storm',
  'user_ray_chen',
  'user_ari_sol',
  'user_noor_lane'
);

-- Remove orphan notifications if any were created before foreign keys/cascades were active.
delete from public.notifications n
where not exists (select 1 from public.profiles p where p.id = n.recipient_id)
   or (n.actor_id is not null and not exists (select 1 from public.profiles p where p.id = n.actor_id));

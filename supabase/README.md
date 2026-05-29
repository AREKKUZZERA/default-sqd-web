# Supabase setup for DEFAULT-SQD-WEB

Release mode uses **closed email/password auth** through Supabase Auth. The frontend does not contain registration UI and does not store passwords.

## Run SQL in this order

For the current existing project, run these in Supabase Dashboard -> SQL Editor:

1. `001_schema.sql` - base tables, RLS enabled, no public demo write policies
2. `003_storage.sql` - creates the private `avatars` bucket
3. `004_closed_auth.sql` - authenticated RLS policies and automatic profile creation for Auth users
4. `005_storage_auth.sql` - authenticated storage read/write policies for avatar/banner uploads
5. `006_release_features.sql` - real notifications, strict direct-message RPC, and notification triggers
6. `008_editing_and_media_cleanup.sql` - edit timestamps, cleanup and message delete policy refresh
7. `007_remove_demo_content.sql` - removes legacy mock/demo profiles and their posts/comments/reactions
8. `009_profile_presence.sql` - last-seen timestamps for real online/offline status
9. `010_storage_auth_refresh.sql` - refreshes private avatar/banner Storage policies if uploads hit RLS errors

`002_seed.sql` intentionally inserts nothing in release mode. Do not seed demo profiles/posts for production.

## GitHub Pages variables

Copy values from Supabase -> Project Settings -> Data API / API Keys:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_BASE_PATH=/default-sqd-web/
```

Add them in GitHub -> Settings -> Environments -> `github-pages` -> Environment variables. For a custom domain, set `VITE_BASE_PATH=/`.

## Create accounts safely

Do **not** put passwords, service-role keys or real account credentials in this repository.

Create accounts manually in Supabase Dashboard:

1. Authentication -> Users -> Add user
2. Set email and a temporary password
3. Enable/confirm the user
4. Optional metadata:

```json
{
  "name": "Your Name",
  "user_id": "your_login",
  "role": "Member"
}
```

`004_closed_auth.sql` creates a database trigger. When a Supabase Auth user is created, a matching row is added to `public.profiles` with `profiles.id = auth.users.id`. Client-side profile updates cannot change `profiles.role`.

## Disable public signup

In Supabase Dashboard, disable public self-signup:

Authentication -> Providers -> Email -> Signups / Allow new users to sign up -> OFF

The frontend only has login UI. Database RLS policies restrict reads/writes to authenticated users and restrict writes to the current user's profile/posts/comments/reactions/messages.

## Private media bucket

The `avatars` bucket is private. Users can upload only into their own folder (`avatars/<auth.uid()>/avatar.webp` and `banner.webp`). The app stores paths in the profile row and creates signed URLs for rendering.

## Removing fake content

Run `007_remove_demo_content.sql` once after the release migration. It deletes legacy demo users:

- `user_mira_vale`
- `user_nika_storm`
- `user_ray_chen`
- `user_ari_sol`
- `user_noor_lane`

Their old posts, comments and reactions are removed automatically by `ON DELETE CASCADE`.

# DEFAULT SQD WEB

Closed social feed frontend for GitHub Pages + Supabase.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` must contain:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
# Optional. Use / for a custom domain.
VITE_BASE_PATH=/default-sqd-web/
```

## Release build

```bash
npm run check
```

GitHub Pages deploy is configured in `.github/workflows/deploy.yml`. Pull requests run the same check/build and upload a preview artifact; deploy runs only on `main` pushes.

## Supabase release setup

Run SQL files in this order:

1. `supabase/001_schema.sql`
2. `supabase/003_storage.sql`
3. `supabase/004_closed_auth.sql`
4. `supabase/005_storage_auth.sql`
5. `supabase/006_release_features.sql`
6. `supabase/008_editing_and_media_cleanup.sql`
7. `supabase/007_remove_demo_content.sql`
8. `supabase/009_profile_presence.sql`

Do not run demo seeds for release. `supabase/002_seed.sql` is intentionally a no-op.

Profile media is stored in a private `avatars` bucket. The app stores only storage paths in `profiles.avatar_image` / `profiles.banner_image` and uses signed URLs for display.

## Accounts

Create real users in Supabase Dashboard -> Authentication -> Users. Registration on the site is disabled; only admin-created accounts can sign in.

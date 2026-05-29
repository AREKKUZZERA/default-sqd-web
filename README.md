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
```

## Release build

```bash
npm run check
```

GitHub Pages deploy is configured in `.github/workflows/deploy.yml`.

## Supabase release setup

Run SQL files in this order:

1. `supabase/001_schema.sql`
2. `supabase/004_closed_auth.sql`
3. `supabase/006_release_features.sql`
4. `supabase/005_storage_auth.sql` optional
5. `supabase/007_remove_demo_content.sql`

Do not run demo seeds for release. `supabase/002_seed.sql` is intentionally a no-op.

## Accounts

Create real users in Supabase Dashboard -> Authentication -> Users. Registration on the site is disabled; only admin-created accounts can sign in.

# DEFAULT-SQD-WEB

Frontend: React + Vite + Tailwind CSS.
Backend for the social feed: Supabase.
Deploy target: GitHub Pages.

## Local start

```bash
npm install
npm run dev
```

Without Supabase env variables the app runs in local mock mode.

## Supabase env

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Then run:

```bash
npm run dev
```

## Supabase SQL setup

Open Supabase Dashboard → SQL Editor and run:

1. `supabase/001_schema.sql`
2. `supabase/002_seed.sql`
3. `supabase/003_storage.sql` optional

Current RLS policies are open for a demo/MVP so GitHub Pages can work with the anon key. Tighten them before a real public production launch.

## GitHub Pages release

The workflow is already in `.github/workflows/deploy.yml`.

For Supabase-backed builds, add these repository variables in GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then push to `main`:

```bash
npm run release
git add .
git commit -m "Prepare GitHub Pages release with Supabase"
git push origin main
```

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run preview      # preview production build
npm run lint         # eslint
npm run release      # lint + build
```

Supabase CLI helpers are included for later:

```bash
npm run supabase:link
npm run supabase:db:push
npm run supabase:db:reset
```

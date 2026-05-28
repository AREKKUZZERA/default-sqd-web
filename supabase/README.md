# Supabase setup for DEFAULT-SQD-WEB

Run these SQL files in Supabase Dashboard → SQL Editor, in this order:

1. `001_schema.sql`
2. `002_seed.sql`
3. `003_storage.sql` — optional, for future avatar/banner uploads

After that copy your values from Supabase → Project Settings → API:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

For GitHub Pages, add them as repository secrets or variables and expose them to Vite during the build.

Current policies are intentionally open for a free demo/MVP. Before a real public production release, switch profiles/posts/comments/reactions to Supabase Auth policies.

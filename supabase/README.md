# Supabase setup for DEFAULT-SQD-WEB

## First setup

Run these SQL files in Supabase Dashboard -> SQL Editor, in this order:

1. `001_schema.sql`
2. `002_seed.sql`
3. `003_storage.sql` - optional, avatar/banner bucket
4. `004_closed_auth.sql` - required for closed login/password auth
5. `005_storage_auth.sql` - optional, locks storage writes to logged-in users

## GitHub Pages variables

Copy values from Supabase -> Project Settings -> Data API / API Keys:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Add them in GitHub -> Settings -> Environments -> `github-pages` -> Environment variables.

## Closed account creation

Do **not** put passwords or service-role keys in this repository.

Create accounts manually in Supabase Dashboard:

1. Authentication -> Users -> Add user
2. Set email and temporary password
3. Confirm the email manually if needed
4. Optional metadata:

```json
{
  "name": "Mira Vale",
  "user_id": "mira_vale",
  "role": "Product designer"
}
```

`004_closed_auth.sql` creates a database trigger. When a Supabase Auth user is created, a matching row is added to `public.profiles` with `profiles.id = auth.users.id`.

## Important security switch

In Supabase Dashboard, disable public self-signup if you want the system truly closed:

Authentication -> Providers -> Email -> Signups / Allow new users to sign up -> OFF

The frontend only has login UI, not registration UI. RLS policies in `004_closed_auth.sql` restrict the database to authenticated users and restrict writes to each user's own profile/posts/comments/reactions.

## Why accounts are not stored in repo

A static GitHub Pages frontend cannot safely create users with an admin key. Passwords must be handled by Supabase Auth. The repository can contain schema, RLS policies, and UI, but not real credentials.

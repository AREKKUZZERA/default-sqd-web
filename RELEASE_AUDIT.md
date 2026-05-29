# DEFAULT SQD release audit

## Fixed in this package

- Removed the remaining direct-message request loop by making message realtime refresh debounced and one-directional.
- Added smooth message autoscroll: opening a chat jumps to the latest message, sending/receiving near the bottom scrolls smoothly to newest.
- Kept users from being pulled away when they scroll up to read older messages.
- Moved direct chat creation to the `create_direct_conversation` Supabase RPC so RLS can stay strict without insert/select deadlocks.
- Optimized conversation list loading so it fetches only the latest nested message per conversation instead of dragging the full message history into the sidebar.
- Added post deletion for the owner with a confirmation prompt.
- Allowed posts without mandatory hashtags.
- Debounced global realtime reloads for posts, comments, reactions, profiles, and notifications.
- Added a real favicon link to avoid the browser `favicon.ico` 404.
- Improved messenger layout: stable chat header, scrollable message body, send-lock while a message is being submitted, smoother message bubble animation.

## Supabase requirements

Run these in order for an existing release database:

1. `supabase/004_closed_auth.sql`
2. `supabase/006_release_features.sql`
3. `supabase/007_remove_demo_content.sql`

The important new function is:

- `public.create_direct_conversation(target_user_id text)`

The frontend now depends on that RPC for direct chat creation.

## What still needs product decisions later

These are not broken code paths, but actual product features that need specs before implementation:

- public user profile pages and profile routing
- full media uploads for post attachments, not only the current post media flag
- follow/following graph
- moderation/admin console
- notification preferences
- password reset / invite email templates

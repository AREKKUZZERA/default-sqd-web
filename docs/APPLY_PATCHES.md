# default-sqd-web security and mobile hardening patches

These files are prepared for `AREKKUZZERA/default-sqd-web`.

## 1. Supabase migration

Copy:

```txt
supabase/migrations/20260529_moderation_and_antispam.sql
```

Then run:

```bash
npm run supabase:db:push
```

or:

```bash
supabase db push
```

Important: the migration assumes `profiles.auth_user_id` exists because the app uses Supabase Auth profiles. If your profile table uses a different auth column name, change `current_profile_id()` accordingly.

## 2. Add helper files

Copy:

```txt
src/shared/lib/spamGuard.js
src/shared/api/moderationApi.js
src/styles/mobile-hardening.css
```

Then import the mobile CSS in `src/styles/index.css`:

```css
@import './mobile-hardening.css';
```

## 3. Change viewport

In `index.html`, replace:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

## 4. Update `src/shared/api/socialApi.js`

Add near the top:

```js
import { assertClientContentAllowed } from '../lib/spamGuard.js';
```

In `createPost`, replace the direct insert with RPC:

```js
assertClientContentAllowed(cleanText, 'Пост');

const { error } = await supabase.rpc('create_post_safe', {
  body: cleanText,
  tag_list: normalizeTags(hashtags),
});
```

In `createComment`, replace the direct insert with RPC:

```js
assertClientContentAllowed(cleanText, 'Комментарий');

const { error } = await supabase.rpc('create_comment_safe', {
  body: cleanText,
  target_post_id: postId,
});
```

In `sendDirectMessage`, replace the direct insert with RPC:

```js
assertClientContentAllowed(cleanText, 'Сообщение');

const { error } = await supabase.rpc('send_direct_message_safe', {
  body: cleanText,
  target_conversation_id: conversationId,
});
```

Keep the existing `if (error) throw ...` and `return fetch...` behavior after each RPC.

## 5. Recommended next UI step

Use `src/shared/api/moderationApi.js` from profile/post/comment/message menus to add:

- Block user
- Unblock user
- Report content
- Warn user, moderator only
- Mute user, moderator only
- Ban/unban user, moderator only

## 6. Test

Run:

```bash
npm run check
```

This repo already defines `check` as lint + unit tests + build.

# Feed, Messages, and Accent Refinement Design

## Scope

Improve three existing surfaces without changing the product identity:

- Feed pagination should feel infinite and avoid unnecessary user clicks.
- Direct messages should open at the latest messages, Telegram-style.
- Visual accents should stay in the current dark amber/green theme but become cleaner and more consistent.

No dev server is required for this work.

## Feed

Use the existing `fetchPostsPage` cursor pagination and `loadMorePosts` state in `AppShell`. Replace the primary "show more" interaction in `Feed` with a bottom sentinel powered by `IntersectionObserver`.

The sentinel should call `onLoadMore` only when:

- there are more posts,
- the app is not already loading,
- no single post route is selected.

Keep a manual fallback button visible when more posts exist so users still have a clear action if observer behavior is unavailable or slow. Show a compact loading state near the sentinel instead of a large layout shift.

## Messages

Keep fetching the newest message page first. When a conversation opens or changes, schedule an immediate `auto` scroll to the bottom after messages render. New outgoing messages and active incoming messages should continue to use smooth bottom scroll when the user is already near the bottom.

For older-message loading, preserve the user's viewport:

1. Capture `scrollHeight` and `scrollTop` before prepending older messages.
2. Append older messages to state at the top.
3. After render, restore `scrollTop` by the height delta.

This prevents the conversation from jumping while browsing history.

## Accent Styling

Keep the current palette and improve consistency:

- Active chips, nav states, and selected conversations use existing amber surfaces with green inset accents.
- Own messages get stronger but still restrained contrast.
- Loading and fallback controls use the same button language as the rest of the app.
- Focus and hover states remain visible, not decorative.

Avoid a broad redesign, new palette, or unrelated component rewrites.

## Verification

Run static checks that do not require a dev server:

- `npm run lint`
- `npm run build`

Do not add tests for this narrow UI behavior unless implementation exposes a small pure helper worth testing.

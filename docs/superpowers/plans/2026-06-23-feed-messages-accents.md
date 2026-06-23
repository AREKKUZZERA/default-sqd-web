# Feed Messages Accents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the feed feel infinite, make direct messages open at the newest messages, and refine accents within the current visual style.

**Architecture:** Keep the existing Supabase cursor pagination and message loading APIs. Add a feed sentinel in `Feed.jsx`, preserve message scroll offsets in `MessagesPanel.jsx`, and tighten styles in existing CSS.

**Tech Stack:** React 19, Vite, Tailwind CSS utilities, Supabase client.

---

## File Structure

- Modify `src/features/feed/Feed.jsx`: add `IntersectionObserver` sentinel and fallback load button.
- Modify `src/features/messages/MessagesPanel.jsx`: add explicit bottom-scroll scheduling and prepend-scroll preservation.
- Modify `src/styles/base.css`: refine feed sentinel, fallback loading, own-message, and selected-chat accents.

### Task 1: Feed Infinite Sentinel

**Files:**
- Modify: `src/features/feed/Feed.jsx`

- [ ] **Step 1: Import React hooks**

Add `useEffect` and `useRef` at the top:

```jsx
import { useEffect, useRef } from 'react';
```

- [ ] **Step 2: Add sentinel observer**

Inside `Feed`, before `return`, create a `loadMoreRef` and observe it:

```jsx
const loadMoreRef = useRef(null);

useEffect(() => {
  if (!hasMore || loadingMore || selectedPostId || !onLoadMore) {
    return undefined;
  }

  const element = loadMoreRef.current;

  if (!element || !('IntersectionObserver' in window)) {
    return undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMore();
      }
    },
    { rootMargin: '480px 0px 720px' },
  );

  observer.observe(element);

  return () => observer.disconnect();
}, [hasMore, loadingMore, onLoadMore, selectedPostId]);
```

- [ ] **Step 3: Replace bottom load block**

Replace the current `hasMore` button block with a sentinel that includes loading text and a fallback button:

```jsx
{hasMore ? (
  <div className="feed-load-more mt-4 grid justify-items-center gap-2" ref={loadMoreRef}>
    <div className="feed-load-more__status rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted">
      {loadingMore ? 'загружаем ленту...' : 'листайте дальше'}
    </div>
    <button
      className="poster-button feed-load-more__button rounded-sqd-xs border border-border bg-surface px-4 py-2 font-ui text-sm font-bold text-text transition hover:border-border-strong hover:bg-surface-2 disabled:cursor-wait disabled:text-muted"
      disabled={loadingMore}
      onClick={onLoadMore}
      type="button"
    >
      {loadingMore ? 'загружаем...' : 'показать ещё'}
    </button>
  </div>
) : null}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/feed/Feed.jsx
git commit -m "feat(feed): add infinite load sentinel"
```

### Task 2: Message Scroll Behavior

**Files:**
- Modify: `src/features/messages/MessagesPanel.jsx`

- [ ] **Step 1: Add prepend restore ref**

Near the existing scroll refs, add:

```jsx
const pendingPrependScrollRef = useRef(null);
```

- [ ] **Step 2: Preserve offset after older messages load**

Update `useLayoutEffect` so prepend restoration runs before bottom scrolling:

```jsx
useLayoutEffect(() => {
  const prependSnapshot = pendingPrependScrollRef.current;
  const element = messagesListRef.current;

  if (prependSnapshot && element) {
    element.scrollTop = element.scrollHeight - prependSnapshot.scrollHeight + prependSnapshot.scrollTop;
    pendingPrependScrollRef.current = null;
    shouldAutoScrollRef.current = false;
    return;
  }

  const behavior = pendingScrollBehaviorRef.current;

  if (behavior) {
    scrollMessagesToBottom(behavior);
    pendingScrollBehaviorRef.current = null;
    shouldAutoScrollRef.current = false;
    return;
  }

  if (shouldAutoScrollRef.current) {
    scrollMessagesToBottom('auto');
    shouldAutoScrollRef.current = false;
  }
}, [activeConversation?.id, activeMessages, scrollMessagesToBottom]);
```

- [ ] **Step 3: Capture scroll before prepending**

At the start of `loadOlderMessages`, before `setLoadingOlder(true)`, capture the list metrics:

```jsx
const element = messagesListRef.current;
pendingPrependScrollRef.current = element
  ? {
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }
  : null;
```

- [ ] **Step 4: Ensure conversation open schedules bottom**

Keep `shouldAutoScrollRef.current = true` in `activeId` changes and use `loadMessages(activeId, { markRead: true, scroll: true })` as the bottom-scroll trigger.

- [ ] **Step 5: Commit**

```bash
git add src/features/messages/MessagesPanel.jsx
git commit -m "fix(messages): preserve chat scroll position"
```

### Task 3: Accent Refinement

**Files:**
- Modify: `src/styles/base.css`

- [ ] **Step 1: Add focused CSS refinements**

Append a small section near the existing message/feed styles:

```css
.feed-load-more__status {
  box-shadow: inset 0 -1px 0 rgba(138, 184, 154, 0.12);
}

.feed-load-more__button {
  min-height: 2.5rem;
}

.messages-conversation-list button[aria-current='true'] {
  border-color: var(--color-border-strong);
}

.message-bubble--own {
  background:
    linear-gradient(180deg, rgba(217, 162, 95, 0.18), rgba(217, 162, 95, 0.1)),
    var(--color-surface-2);
  box-shadow: inset 0 -2px 0 rgba(138, 184, 154, 0.18), 0 8px 22px rgba(0, 0, 0, 0.16);
}
```

- [ ] **Step 2: Mark selected conversation semantically**

In `MessagesPanel.jsx`, add `aria-current={activeId === conversation.id ? 'true' : undefined}` to conversation buttons.

- [ ] **Step 3: Commit**

```bash
git add src/features/messages/MessagesPanel.jsx src/styles/base.css
git commit -m "style(ui): refine feed and chat accents"
```

### Task 4: Static Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: command exits 0.

- [ ] **Step 3: Report**

Summarize changed files, commits, and verification result. Do not start a dev server.

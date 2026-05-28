import { Bell, Check, LogOut, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Feed from '../features/feed/Feed.jsx';
import MessagesPanel from '../features/messages/MessagesPanel.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';
import ProfilePanel from '../features/profile/ProfilePanel.jsx';
import { currentUser as seedUser, initialPosts, people } from '../shared/data/socialData.js';
import {
  createComment as createRemoteComment,
  createPost as createRemotePost,
  fetchPosts,
  getReactionTypeByKey,
  isSupabaseConfigured,
  toggleReaction,
  updateProfile as updateRemoteProfile,
} from '../shared/api/socialApi.js';
import { supabase } from '../shared/lib/supabase.js';
import { buildHashtagTrends } from '../shared/utils/hashtags.js';
import Avatar from '../shared/ui/Avatar.jsx';
import IconButton from '../shared/ui/IconButton.jsx';
import Panel from '../shared/ui/Panel.jsx';

export default function AppShell({ authenticatedUser = null, authError = '', onSignOut = () => {} }) {
  const notificationsRef = useRef(null);
  const settingsRef = useRef(null);
  const [activeView, setActiveView] = useState('feed');
  const [currentUser, setCurrentUser] = useState(authenticatedUser || seedUser);
  const [posts, setPosts] = useState(initialPosts);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('all');
  const [activeAuthor, setActiveAuthor] = useState('all');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [backendReady, setBackendReady] = useState(!isSupabaseConfigured);
  const [backendError, setBackendError] = useState('');

  const notificationCount = notificationsRead ? 0 : 3;
  const displayedBackendError = backendError || authError;

  const loadRemotePosts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      if (!currentUser?.id) {
        return;
      }

      setBackendError('');
      const remotePosts = await fetchPosts(currentUser.id);

      setPosts(remotePosts);
    } catch (error) {
      setBackendError(error.message);
    } finally {
      setBackendReady(true);
    }
  }, [currentUser]);

  useEffect(() => {
    void Promise.resolve().then(loadRemotePosts);
  }, [loadRemotePosts]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    const channel = supabase
      .channel('default-sqd-social-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadRemotePosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadRemotePosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, loadRemotePosts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRemotePosts]);

  useEffect(() => {
    if (!notificationsOpen && !settingsOpen) {
      return undefined;
    }

    const closeOpenPanels = (event) => {
      const clickedNotifications = notificationsRef.current?.contains(event.target);
      const clickedSettings = settingsRef.current?.contains(event.target);

      if (!clickedNotifications && !clickedSettings) {
        setNotificationsOpen(false);
        setSettingsOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOpenPanels);

    return () => document.removeEventListener('pointerdown', closeOpenPanels);
  }, [notificationsOpen, settingsOpen]);

  const displayedUser = useMemo(() => {
    const ownPosts = posts.filter((post) => post.ownerId === currentUser.id).length;
    const ownReposts = posts.filter((post) => post.reposted).length;
    const ownBookmarks = posts.filter((post) => post.bookmarked).length;

    return {
      ...currentUser,
      stats: [
        { label: 'посты', value: String(ownPosts) },
        { label: 'репосты', value: String(ownReposts) },
        { label: 'избранное', value: String(ownBookmarks) },
      ],
    };
  }, [currentUser, posts]);

  const visiblePosts = useMemo(() => {
    const queryTerms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return posts.filter((post) => {
      const tags = post.tags?.length ? post.tags : [post.tag].filter(Boolean);
      const matchesTopic = activeTopic === 'all' || tags.includes(activeTopic);
      const matchesAuthor = activeAuthor === 'all' || post.author === activeAuthor;
      const searchable = `${post.text} ${tags.map((tag) => `#${tag}`).join(' ')}`.toLowerCase();
      const matchesQuery = queryTerms.length === 0 || queryTerms.every((term) => searchable.includes(term));

      return matchesTopic && matchesAuthor && matchesQuery;
    });
  }, [activeAuthor, activeTopic, posts, query]);

  const hashtagTrends = useMemo(() => buildHashtagTrends(posts), [posts]);

  const addPost = async ({ hashtags, mediaAttached = false, text }) => {
    if (isSupabaseConfigured) {
      try {
        const remotePosts = await createRemotePost({ currentUserId: currentUser.id, hashtags, mediaAttached, text });
        setPosts(remotePosts);
      } catch (error) {
        setBackendError(error.message);
      }

      return;
    }

    setPosts((currentPosts) => [
      {
        id: currentPosts.length + 1,
        ownerId: currentUser.id,
        author: currentUser.name,
        userId: currentUser.userId,
        avatar: currentUser.avatar,
        avatarImage: currentUser.avatarImage,
        time: 'сейчас',
        text,
        mediaAttached,
        tag: hashtags[0],
        tags: hashtags,
        likes: 0,
        replies: 0,
        reposts: 0,
        liked: false,
        reposted: false,
        bookmarked: false,
        comments: [],
      },
      ...currentPosts,
    ]);
  };

  const addComment = async (postId, text) => {
    if (isSupabaseConfigured) {
      try {
        const remotePosts = await createRemoteComment({ currentUserId: currentUser.id, postId, text });
        setPosts(remotePosts);
      } catch (error) {
        setBackendError(error.message);
      }

      return;
    }

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [
                ...post.comments,
                {
                  id: `${post.id}_${post.comments.length + 1}`,
                  author: currentUser.name,
                  avatar: currentUser.avatar,
                  avatarImage: currentUser.avatarImage,
                  text,
                },
              ],
            }
          : post,
      ),
    );
  };

  const updateProfile = async (updater) => {
    const nextProfile = typeof updater === 'function' ? updater(currentUser) : updater;

    if (isSupabaseConfigured) {
      try {
        const remoteProfile = await updateRemoteProfile(nextProfile);
        setCurrentUser(remoteProfile);
        await loadRemotePosts();
      } catch (error) {
        setBackendError(error.message);
      }

      return;
    }

    setCurrentUser(nextProfile);
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.ownerId === currentUser.id
          ? {
              ...post,
              author: nextProfile.name,
              userId: nextProfile.userId,
              avatar: nextProfile.avatar,
              avatarImage: nextProfile.avatarImage,
            }
          : post,
      ),
    );
  };

  const togglePost = async (postId, key) => {
    if (isSupabaseConfigured) {
      const type = getReactionTypeByKey(key);
      const post = posts.find((item) => item.id === postId);

      if (!type || !post) {
        return;
      }

      try {
        const remotePosts = await toggleReaction({
          active: Boolean(post[key]),
          currentUserId: currentUser.id,
          postId,
          type,
        });
        setPosts(remotePosts);
      } catch (error) {
        setBackendError(error.message);
      }

      return;
    }

    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        if (key === 'liked') {
          return { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) };
        }

        if (key === 'reposted') {
          return { ...post, reposted: !post.reposted, reposts: post.reposts + (post.reposted ? -1 : 1) };
        }

        return { ...post, [key]: !post[key] };
      }),
    );
  };

  const showProfile = () => setActiveView('profile');
  const showFeed = () => setActiveView('feed');

  const selectTopic = (topic) => {
    setActiveTopic(topic);
    setActiveAuthor('all');
    setActiveView('feed');
  };

  const selectAuthor = (author) => {
    setActiveAuthor(author);
    setActiveTopic('all');
    setActiveView('feed');
  };

  return (
    <div className="poster-app min-h-screen px-4 py-4 text-text sm:px-6 lg:px-8" data-density={compactMode ? 'compact' : 'default'}>
      <header className="poster-header relative z-50 mx-auto mb-5 flex max-w-[var(--shell-width)] items-center gap-3 rounded-sqd-md border border-border bg-bg-soft/90 px-3 py-3 backdrop-blur-md">
        <button aria-label="Открыть ленту" className="flex items-center gap-3 text-left" onClick={showFeed} type="button">
          <span className="grid h-10 w-10 place-items-center rounded-sqd-sm border border-border bg-accent-soft font-ui text-sm font-bold leading-none text-text">
            SQD
          </span>
          <span className="hidden font-display text-2xl font-extrabold uppercase leading-none text-text sm:block">
            default squad<span className="text-accent">.</span>
          </span>
        </button>

        <label className="ml-auto hidden min-w-56 items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text-soft transition-within focus-within:border-border-strong lg:flex">
          <Search size={16} strokeWidth={1.8} />
          <input
            className="w-full border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск"
            type="search"
            value={query}
          />
        </label>

        <div className="relative" ref={notificationsRef}>
          <IconButton
            active={notificationCount > 0 || notificationsOpen}
            icon={Bell}
            label="Уведомления"
            onClick={() => {
              setNotificationsOpen((isOpen) => !isOpen);
              setSettingsOpen(false);
            }}
          >
            {notificationCount > 0 ? notificationCount : null}
          </IconButton>
          {notificationsOpen ? (
            <Panel className="absolute right-0 top-12 z-[60] w-72 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-ui text-sm font-bold text-text">Уведомления</p>
                <button
                  className="font-ui text-xs font-semibold text-text-soft hover:text-text"
                  onClick={() => setNotificationsRead(true)}
                  type="button"
                >
                  Прочитать
                </button>
              </div>
              <div className="grid gap-2">
                {['Nika ответила на пост', 'Ray сделал репост', 'Ari добавил вас в диалог'].map((item) => (
              <div className="rounded-sqd-xs border border-border bg-surface-2/70 p-3 text-sm text-text-soft" key={item}>
                    {item}
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="relative" ref={settingsRef}>
          <IconButton
            active={settingsOpen}
            icon={Settings}
            label="Настройки"
            onClick={() => {
              setSettingsOpen((isOpen) => !isOpen);
              setNotificationsOpen(false);
            }}
          />
          {settingsOpen ? (
            <Panel className="absolute right-0 top-12 z-[60] w-72 p-3">
              <p className="mb-3 font-ui text-sm font-bold text-text">Настройки интерфейса</p>
              <label className="flex items-center justify-between gap-3 rounded-sqd-xs border border-border bg-surface-2/70 p-3 text-sm text-text-soft">
                Компактная тема
                <input
                  checked={compactMode}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                  onChange={(event) => setCompactMode(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-muted">
                <Check size={14} strokeWidth={1.8} />
                Тема сохранена локально
              </div>
            </Panel>
          ) : null}
        </div>

        {isSupabaseConfigured ? (
          <IconButton icon={LogOut} label="Выйти" onClick={onSignOut} />
        ) : null}

        <button aria-label="Открыть профиль" onClick={showProfile} type="button">
          <Avatar image={displayedUser.avatarImage} label={displayedUser.avatar} active />
        </button>
      </header>

      <label className="mx-auto mb-4 flex max-w-[var(--shell-width)] items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/75 px-3 py-2 text-text-soft shadow-[var(--shadow-panel)] transition-within focus-within:border-border-strong lg:hidden">
        <Search size={16} strokeWidth={1.8} />
        <input
          className="w-full border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по ленте"
          type="search"
          value={query}
        />
      </label>

      {displayedBackendError ? (
        <div className="mx-auto mb-4 max-w-[var(--shell-width)] rounded-sqd-sm border border-warning/45 bg-warning/10 px-3 py-2 font-ui text-sm text-warning">
          Supabase: {displayedBackendError}
        </div>
      ) : null}

      {!backendReady ? (
        <div className="mx-auto mb-4 max-w-[var(--shell-width)] rounded-sqd-sm border border-border bg-surface/80 px-3 py-2 font-ui text-sm text-text-soft">
          Загружаем ленту из Supabase...
        </div>
      ) : null}

      <main className="mx-auto grid max-w-[var(--shell-width)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <ProfilePanel
            activeView={activeView}
            currentUser={displayedUser}
            onNavigate={setActiveView}
            onOpenProfile={showProfile}
            onSelectTopic={selectTopic}
            trends={hashtagTrends}
          />
        </aside>

        {activeView === 'messages' ? (
          <MessagesPanel currentUser={displayedUser} expanded people={people} />
        ) : activeView === 'profile' ? (
          <ProfilePage
            currentUser={displayedUser}
            onCommentPost={addComment}
            onTogglePost={togglePost}
            onUpdateProfile={updateProfile}
            people={people}
            posts={posts}
          />
        ) : (
          <Feed
            activeAuthor={activeAuthor}
            compactMode={compactMode}
            currentUser={displayedUser}
            onAddPost={addPost}
            onCommentPost={addComment}
            onSelectAuthor={selectAuthor}
            onTogglePost={togglePost}
            posts={visiblePosts}
            query={query}
          />
        )}
      </main>
    </div>
  );
}

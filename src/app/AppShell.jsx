import { Bell, Check, Home, LogOut, MessageCircle, Search, Settings, UserCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Feed from '../features/feed/Feed.jsx';
import MessagesPanel from '../features/messages/MessagesPanel.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';
import ProfilePanel from '../features/profile/ProfilePanel.jsx';
import {
  createComment as createRemoteComment,
  createPost as createRemotePost,
  deletePost as deleteRemotePost,
  fetchNotifications,
  fetchPosts,
  fetchProfiles,
  getReactionTypeByKey,
  markNotificationsRead,
  toggleReaction,
  updateProfile as updateRemoteProfile,
} from '../shared/api/socialApi.js';
import { supabase } from '../shared/lib/supabase.js';
import { buildHashtagTrends } from '../shared/utils/hashtags.js';
import Avatar from '../shared/ui/Avatar.jsx';
import IconButton from '../shared/ui/IconButton.jsx';
import Panel from '../shared/ui/Panel.jsx';

const mobileNavigation = [
  { icon: Home, label: 'Лента', target: 'feed' },
  { icon: MessageCircle, label: 'Сообщения', target: 'messages' },
  { icon: UserCircle, label: 'Профиль', target: 'profile' },
];

export default function AppShell({ authenticatedUser, authError = '', onSignOut = () => {} }) {
  const notificationsRef = useRef(null);
  const settingsRef = useRef(null);
  const remoteReloadTimerRef = useRef(null);
  const [activeView, setActiveView] = useState('feed');
  const [currentUser, setCurrentUser] = useState(authenticatedUser);
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('all');
  const [activeAuthor, setActiveAuthor] = useState('all');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('default-sqd-density') === 'compact');
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState('');

  const unreadNotifications = notifications.filter((item) => !item.readAt).length;
  const displayedBackendError = backendError || authError;


  useEffect(() => {
    localStorage.setItem('default-sqd-density', compactMode ? 'compact' : 'default');
  }, [compactMode]);

  const loadRemoteData = useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }

    try {
      setBackendError('');
      const [remoteProfiles, remotePosts, remoteNotifications] = await Promise.all([
        fetchProfiles(),
        fetchPosts(currentUser.id),
        fetchNotifications(currentUser.id),
      ]);

      setPeople(remoteProfiles);
      setPosts(remotePosts);
      setNotifications(remoteNotifications);
    } catch (error) {
      setBackendError(error.message);
    } finally {
      setBackendReady(true);
    }
  }, [currentUser]);

  useEffect(() => {
    void Promise.resolve().then(loadRemoteData);
  }, [loadRemoteData]);

  useEffect(() => {
    if (!currentUser?.id) {
      return undefined;
    }

    const scheduleRemoteReload = () => {
      window.clearTimeout(remoteReloadTimerRef.current);
      remoteReloadTimerRef.current = window.setTimeout(() => {
        void loadRemoteData();
      }, 350);
    };

    const channel = supabase
      .channel(`default-sqd-release-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRemoteReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, scheduleRemoteReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, scheduleRemoteReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, scheduleRemoteReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUser.id}` }, scheduleRemoteReload)
      .subscribe();

    return () => {
      window.clearTimeout(remoteReloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, loadRemoteData]);

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
    const freshProfile = people.find((person) => person.id === currentUser?.id) || currentUser;
    const ownPosts = posts.filter((post) => post.ownerId === currentUser.id).length;
    const ownReposts = posts.filter((post) => post.reposted).length;
    const ownBookmarks = posts.filter((post) => post.bookmarked).length;

    return {
      ...freshProfile,
      stats: [
        { label: 'посты', value: String(ownPosts) },
        { label: 'репосты', value: String(ownReposts) },
        { label: 'избранное', value: String(ownBookmarks) },
      ],
    };
  }, [currentUser, people, posts]);

  const authorFilters = useMemo(
    () => [
      { label: 'Все', value: 'all', caption: 'все авторы' },
      ...people.map((person) => ({ label: person.name, value: person.id, caption: `@${person.userId}` })),
    ],
    [people],
  );

  const visiblePosts = useMemo(() => {
    const queryTerms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return posts.filter((post) => {
      const tags = post.tags?.length ? post.tags : [post.tag].filter(Boolean);
      const matchesTopic = activeTopic === 'all' || tags.includes(activeTopic);
      const matchesAuthor = activeAuthor === 'all' || post.ownerId === activeAuthor;
      const searchable = `${post.author} @${post.userId} ${post.text} ${tags.map((tag) => `#${tag}`).join(' ')}`.toLowerCase();
      const matchesQuery = queryTerms.length === 0 || queryTerms.every((term) => searchable.includes(term));

      return matchesTopic && matchesAuthor && matchesQuery;
    });
  }, [activeAuthor, activeTopic, posts, query]);

  const hashtagTrends = useMemo(() => buildHashtagTrends(posts), [posts]);

  const addPost = async ({ hashtags, mediaAttached = false, text }) => {
    try {
      const remotePosts = await createRemotePost({ currentUserId: currentUser.id, hashtags, mediaAttached, text });
      setPosts(remotePosts);
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const addComment = async (postId, text) => {
    try {
      const remotePosts = await createRemoteComment({ currentUserId: currentUser.id, postId, text });
      setPosts(remotePosts);
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const deletePost = async (postId) => {
    try {
      const remotePosts = await deleteRemotePost({ currentUserId: currentUser.id, postId });
      setPosts(remotePosts);
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const updateProfile = async (updater) => {
    const nextProfile = typeof updater === 'function' ? updater(displayedUser) : updater;

    try {
      const remoteProfile = await updateRemoteProfile(nextProfile);
      setCurrentUser(remoteProfile);
      await loadRemoteData();
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const togglePost = async (postId, key) => {
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
  };

  const markAllNotificationsRead = async () => {
    try {
      const nextNotifications = await markNotificationsRead(currentUser.id);
      setNotifications(nextNotifications);
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const showProfile = () => setActiveView('profile');
  const showFeed = () => setActiveView('feed');

  const selectTopic = (topic) => {
    setActiveTopic(topic);
    setActiveAuthor('all');
    setActiveView('feed');
  };

  const selectAuthor = (authorId) => {
    setActiveAuthor(authorId);
    setActiveTopic('all');
    setActiveView('feed');
  };

  return (
    <div className="poster-app min-h-screen px-3 pb-24 pt-3 text-text sm:px-6 sm:py-4 lg:px-8" data-density={compactMode ? 'compact' : 'default'}>
      <header className="poster-header sticky top-3 z-50 mx-auto mb-4 flex max-w-[var(--shell-width)] items-center gap-2 rounded-sqd-md border border-border bg-bg-soft/92 px-3 py-3 shadow-[var(--shadow-panel)] backdrop-blur-md sm:gap-3">
        <button aria-label="Открыть ленту" className="flex min-w-0 items-center gap-3 text-left" onClick={showFeed} type="button">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sqd-sm border border-border bg-accent-soft font-ui text-sm font-bold leading-none text-text">
            SQD
          </span>
          <span className="hidden truncate font-display text-2xl font-extrabold uppercase leading-none text-text sm:block">
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
            active={unreadNotifications > 0 || notificationsOpen}
            icon={Bell}
            label="Уведомления"
            onClick={() => {
              setNotificationsOpen((isOpen) => !isOpen);
              setSettingsOpen(false);
            }}
          >
            {unreadNotifications > 0 ? unreadNotifications : null}
          </IconButton>
          {notificationsOpen ? (
            <Panel className="absolute right-0 top-12 z-[60] w-[min(20rem,calc(100vw-1.5rem))] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-ui text-sm font-bold text-text">Уведомления</p>
                <button
                  className="font-ui text-xs font-semibold text-text-soft hover:text-text disabled:cursor-not-allowed disabled:text-muted"
                  disabled={unreadNotifications === 0}
                  onClick={markAllNotificationsRead}
                  type="button"
                >
                  Прочитать
                </button>
              </div>
              <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                {notifications.length > 0 ? (
                  notifications.map((item) => (
                    <div
                      className={[
                        'flex gap-2 rounded-sqd-xs border p-3 text-sm',
                        item.readAt ? 'border-border bg-surface-2/70 text-text-soft' : 'border-border-strong bg-accent-soft text-text',
                      ].join(' ')}
                      key={item.id}
                    >
                      <Avatar image={item.actorAvatarImage} label={item.actorAvatar} size="sm" />
                      <div className="min-w-0">
                        <p className="leading-5">{item.text}</p>
                        <p className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted">{item.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-sqd-xs border border-border bg-surface-2/70 p-3 text-sm text-text-soft">
                    Новых уведомлений нет.
                  </p>
                )}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="relative hidden sm:block" ref={settingsRef}>
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

        <IconButton icon={LogOut} label="Выйти" onClick={onSignOut} />

        <button aria-label="Открыть профиль" className="hidden sm:block" onClick={showProfile} type="button">
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
          Загружаем данные из Supabase...
        </div>
      ) : null}

      <main className="mx-auto grid max-w-[var(--shell-width)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
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
            onDeletePost={deletePost}
            onTogglePost={togglePost}
            onUpdateProfile={updateProfile}
            people={people}
            posts={posts}
          />
        ) : (
          <Feed
            activeAuthor={activeAuthor}
            authors={authorFilters}
            compactMode={compactMode}
            currentUser={displayedUser}
            onAddPost={addPost}
            onCommentPost={addComment}
            onDeletePost={deletePost}
            onSelectAuthor={selectAuthor}
            onTogglePost={togglePost}
            posts={visiblePosts}
            query={query}
          />
        )}
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-3 gap-2 rounded-sqd-md border border-border bg-bg-soft/95 p-2 shadow-[var(--shadow-panel)] backdrop-blur-md lg:hidden" aria-label="Мобильная навигация">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.target;

          return (
            <button
              className={[
                'flex min-h-12 flex-col items-center justify-center gap-1 rounded-sqd-xs border px-2 py-2 font-ui text-[0.68rem] font-bold transition',
                active
                  ? 'border-border-strong bg-accent-soft text-text shadow-[inset_0_-2px_0_var(--color-positive)]'
                  : 'border-border bg-surface-2/70 text-text-soft',
              ].join(' ')}
              key={item.target}
              onClick={() => setActiveView(item.target)}
              type="button"
            >
              <Icon size={17} strokeWidth={1.8} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

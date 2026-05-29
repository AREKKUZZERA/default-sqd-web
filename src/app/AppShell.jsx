import { Bell, Home, LogOut, MessageCircle, Search, Settings, UserCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Feed from '../features/feed/Feed.jsx';
import MessagesPanel from '../features/messages/MessagesPanel.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';
import ProfilePanel from '../features/profile/ProfilePanel.jsx';
import {
  createComment as createRemoteComment,
  createDirectConversation,
  createPost as createRemotePost,
  deleteComment as deleteRemoteComment,
  deletePost as deleteRemotePost,
  fetchNotifications,
  fetchPosts,
  fetchProfiles,
  getReactionTypeByKey,
  markNotificationsRead,
  toggleReaction,
  updateComment as updateRemoteComment,
  updatePost as updateRemotePost,
  updateProfile as updateRemoteProfile,
} from '../shared/api/socialApi.js';
import { supabase } from '../shared/lib/supabase.js';
import { buildHashtagTrends, extractHashtags } from '../shared/utils/hashtags.js';
import Avatar from '../shared/ui/Avatar.jsx';
import IconButton from '../shared/ui/IconButton.jsx';
import Panel from '../shared/ui/Panel.jsx';

const mobileNavigation = [
  { icon: Home, label: 'Лента', target: 'feed' },
  { icon: MessageCircle, label: 'Сообщения', target: 'messages' },
  { icon: UserCircle, label: 'Профиль', target: 'profile' },
];

const APP_BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');

const stripBasePath = (pathname = window.location.pathname) => {
  if (!APP_BASE_PATH || APP_BASE_PATH === '/') {
    return pathname || '/';
  }

  if (pathname === APP_BASE_PATH) {
    return '/';
  }

  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || '/';
  }

  return pathname || '/';
};

const withBasePath = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!APP_BASE_PATH || APP_BASE_PATH === '/') {
    return normalizedPath;
  }

  return normalizedPath === '/' ? `${APP_BASE_PATH}/` : `${APP_BASE_PATH}${normalizedPath}`;
};

const getProfileKeyFromPath = () => {
  const appPath = stripBasePath();
  const match = appPath.match(/^\/profile\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
};

const getMessageConversationIdFromPath = () => {
  const appPath = stripBasePath();
  const match = appPath.match(/^\/messages(?:\/([^/]+))?\/?$/);
  return match ? decodeURIComponent(match[1] || '') : null;
};

const getInitialView = () => {
  if (getProfileKeyFromPath()) return 'profile';
  if (getMessageConversationIdFromPath() !== null) return 'messages';
  return 'feed';
};

const updateBrowserPath = (path) => {
  const nextPath = withBasePath(path);

  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath);
  }
};

const getWallPosts = (profileId, posts) =>
  posts.filter(
    (post) =>
      post.ownerId === profileId ||
      post.likedBy?.includes(profileId) ||
      post.repostedBy?.includes(profileId) ||
      post.bookmarkedBy?.includes(profileId),
  );

export default function AppShell({ authenticatedUser, authError = '', onSignOut = () => {} }) {
  const notificationsRef = useRef(null);
  const settingsRef = useRef(null);
  const remoteReloadTimerRef = useRef(null);
  const [activeView, setActiveView] = useState(getInitialView);
  const [currentUser, setCurrentUser] = useState(authenticatedUser);
  const [selectedProfileKey, setSelectedProfileKey] = useState(() => getProfileKeyFromPath() || authenticatedUser.userId || authenticatedUser.id);
  const [preferredConversationId, setPreferredConversationId] = useState(() => getMessageConversationIdFromPath() || null);
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

  const getProfileWithStats = useCallback(
    (profile) => {
      const profilePosts = posts.filter((post) => post.ownerId === profile.id);
      const wallPosts = getWallPosts(profile.id, posts);

      return {
        ...profile,
        stats: [
          { label: 'стена', value: String(wallPosts.length) },
          { label: 'ответы', value: String(profilePosts.reduce((sum, post) => sum + post.comments.length, 0)) },
          { label: 'реакции', value: String(profilePosts.reduce((sum, post) => sum + post.likes + post.reposts, 0)) },
        ],
      };
    },
    [posts],
  );

  const displayedUser = useMemo(() => {
    const freshProfile = people.find((person) => person.id === currentUser?.id) || currentUser;
    return getProfileWithStats(freshProfile);
  }, [currentUser, getProfileWithStats, people]);

  const selectedProfile = useMemo(() => {
    const profile = people.find((person) => person.id === selectedProfileKey || person.userId === selectedProfileKey);

    if (profile) {
      return getProfileWithStats(profile);
    }

    if (selectedProfileKey === displayedUser.id || selectedProfileKey === displayedUser.userId) {
      return displayedUser;
    }

    return null;
  }, [displayedUser, getProfileWithStats, people, selectedProfileKey]);

  const activeConversationPathId = activeView === 'messages' ? preferredConversationId : null;
  const profileMissing = activeView === 'profile' && backendReady && !selectedProfile;

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

  const addPost = async ({ hashtags, text }) => {
    const previousPosts = posts;

    try {
      const remotePosts = await createRemotePost({ currentUserId: currentUser.id, hashtags, text });
      setPosts(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
      throw error;
    }
  };

  const addComment = async (postId, text) => {
    const previousPosts = posts;
    const temporaryComment = {
      id: `pending-comment-${Date.now()}`,
      author: displayedUser.name,
      authorId: currentUser.id,
      avatar: displayedUser.avatar,
      avatarImage: displayedUser.avatarImage,
      pending: true,
      text,
      time: 'отправляется',
      userId: displayedUser.userId,
    };

    setPosts((items) =>
      items.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, temporaryComment],
              replies: post.replies + 1,
            }
          : post,
      ),
    );

    try {
      const remotePosts = await createRemoteComment({ currentUserId: currentUser.id, postId, text });
      setPosts(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
      throw error;
    }
  };

  const deletePost = async (postId) => {
    const previousPosts = posts;
    setPosts((items) => items.filter((post) => post.id !== postId));

    try {
      const remotePosts = await deleteRemotePost({ currentUserId: currentUser.id, postId });
      setPosts(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
      throw error;
    }
  };

  const deleteComment = async (commentId) => {
    const previousPosts = posts;
    setPosts((items) =>
      items.map((post) => ({
        ...post,
        comments: post.comments.filter((comment) => comment.id !== commentId),
        replies: post.comments.some((comment) => comment.id === commentId) ? Math.max(0, post.replies - 1) : post.replies,
      })),
    );

    try {
      const remotePosts = await deleteRemoteComment({ commentId, currentUserId: currentUser.id });
      setPosts(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
      throw error;
    }
  };

  const updateComment = async (commentId, text) => {
    const previousPosts = posts;
    setPosts((items) =>
      items.map((post) => ({
        ...post,
        comments: post.comments.map((comment) => (comment.id === commentId ? { ...comment, edited: true, pending: true, text } : comment)),
      })),
    );

    try {
      const remotePosts = await updateRemoteComment({ commentId, currentUserId: currentUser.id, text });
      setPosts(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
      throw error;
    }
  };

  const updatePost = async (postId, text) => {
    const previousPosts = posts;
    const hashtags = extractHashtags(text);

    setPosts((items) =>
      items.map((post) => (post.id === postId ? { ...post, edited: true, pending: true, tag: hashtags[0], tags: hashtags, text } : post)),
    );

    try {
      const remotePosts = await updateRemotePost({ currentUserId: currentUser.id, hashtags, postId, text });
      setPosts(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
      throw error;
    }
  };

  const updateProfile = async (updater) => {
    const nextProfile = typeof updater === 'function' ? updater(displayedUser) : updater;
    const remoteProfile = await updateRemoteProfile(nextProfile);
    setCurrentUser(remoteProfile);
    await loadRemoteData();
  };

  const togglePost = async (postId, key) => {
    const type = getReactionTypeByKey(key);
    const post = posts.find((item) => item.id === postId);

    if (!type || !post) {
      return;
    }

    const wasActive = Boolean(post[key]);
    const countKey = type === 'like' ? 'likes' : type === 'repost' ? 'reposts' : null;
    const listKey = type === 'like' ? 'likedBy' : type === 'repost' ? 'repostedBy' : 'bookmarkedBy';
    const previousPosts = posts;

    setPosts((items) =>
      items.map((item) => {
        if (item.id !== postId) {
          return item;
        }

        const nextList = wasActive
          ? (item[listKey] || []).filter((id) => id !== currentUser.id)
          : Array.from(new Set([...(item[listKey] || []), currentUser.id]));

        return {
          ...item,
          [key]: !wasActive,
          [listKey]: nextList,
          ...(countKey
            ? {
                [countKey]: Math.max(0, item[countKey] + (wasActive ? -1 : 1)),
              }
            : {}),
        };
      }),
    );

    try {
      const remotePosts = await toggleReaction({
        active: wasActive,
        currentUserId: currentUser.id,
        postId,
        type,
      });
      setPosts(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
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

  const clearPreferredConversation = useCallback(() => {}, []);

  const showMessages = useCallback((conversationId = null) => {
    setActiveView('messages');
    setPreferredConversationId(conversationId);
    updateBrowserPath(conversationId ? `/messages/${encodeURIComponent(conversationId)}` : '/messages');
  }, []);

  const showProfile = (profileId = currentUser.id) => {
    setPreferredConversationId(null);
    const profile = people.find((person) => person.id === profileId || person.userId === profileId);
    const isOwnProfile = profileId === currentUser.id || profileId === currentUser.userId;
    const profileKey = profile?.userId || (isOwnProfile ? displayedUser.userId : profileId);
    setSelectedProfileKey(profileKey);
    setActiveView('profile');
    updateBrowserPath(`/profile/${encodeURIComponent(profileKey)}`);
  };
  const showOwnProfile = () => showProfile(currentUser.id);
  const showFeed = () => {
    setPreferredConversationId(null);
    setActiveView('feed');
    updateBrowserPath('/');
  };
  const navigateView = (target) => {
    if (target === 'profile') {
      showOwnProfile();
      return;
    }

    if (target === 'messages') {
      showMessages(preferredConversationId);
      return;
    }

    setActiveView(target);
    updateBrowserPath('/');
  };

  const handleConversationChange = useCallback((conversationId) => {
    setPreferredConversationId(conversationId || null);
    updateBrowserPath(conversationId ? `/messages/${encodeURIComponent(conversationId)}` : '/messages');
  }, []);

  const startConversation = async (profileId) => {
    if (!profileId || profileId === currentUser.id) {
      return;
    }

    try {
      setBackendError('');
      const conversationId = await createDirectConversation(currentUser.id, profileId);
      showMessages(conversationId);
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const selectTopic = (topic) => {
    setPreferredConversationId(null);
    setActiveTopic(topic);
    setActiveAuthor('all');
    setActiveView('feed');
    updateBrowserPath('/');
  };

  const selectAuthor = (authorId) => {
    setPreferredConversationId(null);
    setActiveAuthor(authorId);
    setActiveTopic('all');
    setActiveView('feed');
    updateBrowserPath('/');
  };

  useEffect(() => {
    const syncRoute = () => {
      const profileKey = getProfileKeyFromPath();
      const conversationId = getMessageConversationIdFromPath();

      if (profileKey) {
        setSelectedProfileKey(profileKey);
        setActiveView('profile');
        return;
      }

      if (conversationId !== null) {
        setPreferredConversationId(conversationId || null);
        setActiveView('messages');
        return;
      }

      setPreferredConversationId(null);
      setActiveView('feed');
    };

    syncRoute();

    window.addEventListener('popstate', syncRoute);

    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  return (
    <div
      className={[
        'poster-app min-h-screen px-3 pb-24 pt-3 text-text sm:px-5 sm:py-5 lg:px-8',
        activeView === 'messages' ? 'poster-app--messages' : '',
      ].join(' ')}
      data-active-view={activeView}
      data-density={compactMode ? 'compact' : 'default'}
    >
      <header className="poster-header sticky top-3 z-50 mx-auto mb-5 flex max-w-[var(--shell-width)] items-center gap-2 rounded-sqd-md border border-border bg-bg-soft/92 px-3 py-3 shadow-[var(--shadow-panel)] backdrop-blur-md sm:gap-3">
        <button aria-label="Открыть ленту" className="flex min-w-0 items-center gap-3 text-left" onClick={showFeed} type="button">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sqd-sm border border-border bg-accent-soft font-ui text-sm font-bold leading-none text-text">
            SQD
          </span>
          <span className="hidden truncate font-display text-2xl font-extrabold uppercase leading-none text-text sm:block">
            default squad<span className="text-accent">.</span>
          </span>
        </button>

        <label className="ml-auto hidden min-w-56 items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text-soft transition focus-within:border-border-strong lg:flex">
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
                      <button
                        aria-label={`Открыть профиль ${item.actorName}`}
                        className="self-start rounded-sqd-sm text-left transition hover:opacity-85"
                        onClick={() => {
                          setNotificationsOpen(false);
                          showProfile(item.actorId);
                        }}
                        type="button"
                      >
                        <Avatar image={item.actorAvatarImage} label={item.actorAvatar} size="sm" />
                      </button>
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
              <p className="mb-3 font-ui text-sm font-bold text-text">Настройки</p>
              <label className="flex items-center justify-between gap-3 rounded-sqd-xs border border-border bg-surface-2/70 p-3 text-sm text-text-soft">
                Компактный режим
                <input
                  checked={compactMode}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                  onChange={(event) => setCompactMode(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </Panel>
          ) : null}
        </div>

        <IconButton icon={LogOut} label="Выйти" onClick={onSignOut} />

        <button aria-label="Открыть профиль" className="hidden sm:block" onClick={showOwnProfile} type="button">
          <Avatar image={displayedUser.avatarImage} label={displayedUser.avatar} active />
        </button>
      </header>

      <label className="poster-mobile-search mx-auto mb-5 flex max-w-[var(--shell-width)] items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/75 px-3 py-2 text-text-soft shadow-[var(--shadow-panel)] transition focus-within:border-border-strong lg:hidden">
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
          {displayedBackendError}
        </div>
      ) : null}

      {!backendReady ? (
        <div className="mx-auto mb-4 max-w-[var(--shell-width)] rounded-sqd-sm border border-border bg-surface/80 px-3 py-2 font-ui text-sm text-text-soft">
          Загружаем данные...
        </div>
      ) : null}

      <main className="poster-main mx-auto grid max-w-[var(--shell-width)] gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <ProfilePanel
            activeView={activeView}
            currentUser={displayedUser}
            onNavigate={navigateView}
            onOpenProfile={showOwnProfile}
            onSelectTopic={selectTopic}
            trends={hashtagTrends}
          />
        </aside>

        {activeView === 'messages' ? (
          <MessagesPanel
            currentUser={displayedUser}
            expanded
            onConversationPathChange={handleConversationChange}
            onOpenProfile={showProfile}
            onPreferredConversationHandled={clearPreferredConversation}
            people={people}
            preferredConversationId={activeConversationPathId}
          />
        ) : activeView === 'profile' ? (
          <ProfilePage
            currentUser={displayedUser}
            key={selectedProfile?.id || selectedProfileKey}
            missing={profileMissing}
            onCommentPost={addComment}
            onDeleteComment={deleteComment}
            onDeletePost={deletePost}
            onMessage={startConversation}
            onOpenProfile={showProfile}
            onTogglePost={togglePost}
            onUpdateComment={updateComment}
            onUpdatePost={updatePost}
            onUpdateProfile={updateProfile}
            people={people}
            posts={posts}
            profileUser={selectedProfile}
            requestedProfileKey={selectedProfileKey}
          />
        ) : (
          <Feed
            activeAuthor={activeAuthor}
            authors={authorFilters}
            compactMode={compactMode}
            currentUser={displayedUser}
            onAddPost={addPost}
            onCommentPost={addComment}
            onDeleteComment={deleteComment}
            onDeletePost={deletePost}
            onOpenProfile={showProfile}
            onSelectAuthor={selectAuthor}
            onTogglePost={togglePost}
            onUpdateComment={updateComment}
            onUpdatePost={updatePost}
            posts={visiblePosts}
            query={query}
          />
        )}
      </main>

      <nav className={[
        'fixed inset-x-3 bottom-3 z-50 grid grid-cols-3 gap-2 rounded-sqd-md border border-border bg-bg-soft/95 p-2 shadow-[var(--shadow-panel)] backdrop-blur-md lg:hidden',
        activeView === 'messages' ? 'hidden' : '',
      ].join(' ')} aria-label="Мобильная навигация">
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
              onClick={() => navigateView(item.target)}
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

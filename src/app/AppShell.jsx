import { Bell, Home, LogOut, MessageCircle, Search, Settings, ShieldAlert, UserCircle } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Feed from '../features/feed/Feed.jsx';
import ReportDialog from '../features/moderation/ReportDialog.jsx';

import ProfilePanel from '../features/profile/ProfilePanel.jsx';
import {
  createComment as createRemoteComment,
  createDirectConversation,
  createPost as createRemotePost,
  deleteComment as deleteRemoteComment,
  deletePost as deleteRemotePost,
  fetchNotifications,
  fetchPostById,
  fetchPostsPage,
  fetchProfiles,
  getReactionTypeByKey,
  markNotificationsRead,
  toggleReaction,
  updateComment as updateRemoteComment,
  updatePost as updateRemotePost,
  updateProfile as updateRemoteProfile,
  uploadProfileImage as uploadRemoteProfileImage,
} from '../shared/api/socialApi.js';
import { reportContent } from '../shared/api/moderationApi.js';
import useOnlinePresence from '../shared/hooks/useOnlinePresence.js';
import { supabase } from '../shared/lib/supabase.js';
import { applyPresenceStatus } from '../shared/utils/presence.js';
import { buildHashtagTrends, extractHashtags } from '../shared/utils/hashtags.js';
import Avatar from '../shared/ui/Avatar.jsx';
import IconButton from '../shared/ui/IconButton.jsx';
import Panel from '../shared/ui/Panel.jsx';

const mobileNavigation = [
  { icon: Home, label: 'Лента', target: 'feed' },
  { icon: MessageCircle, label: 'Сообщения', target: 'messages' },
  { icon: UserCircle, label: 'Профиль', target: 'profile' },
];


const MessagesPanel = lazy(() => import('../features/messages/MessagesPanel.jsx'));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage.jsx'));
const ModerationPanel = lazy(() => import('../features/moderation/ModerationPanel.jsx')); 

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

const getHashAppPath = () => {
  const hashPath = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '';
  return hashPath || '';
};

const getAppPath = () => getHashAppPath() || stripBasePath();

const getProfileKeyFromPath = () => {
  const appPath = getAppPath();
  const match = appPath.match(/^\/profile\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
};

const getMessageConversationIdFromPath = () => {
  const appPath = getAppPath();
  const match = appPath.match(/^\/messages(?:\/([^/]+))?\/?$/);
  return match ? decodeURIComponent(match[1] || '') : null;
};

const getPostIdFromPath = () => {
  const appPath = getAppPath();
  const match = appPath.match(/^\/post\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
};

const isSamePostId = (left, right) => String(left || '') === String(right || '');

const hasModerationAccess = (profile) => ['admin', 'administrator', 'moderator', 'mod'].includes(String(profile?.role || '').toLowerCase());

const getInitialView = () => {
  if (getProfileKeyFromPath()) return 'profile';
  if (getMessageConversationIdFromPath() !== null) return 'messages';
  if (getAppPath().match(/^\/moderation\/?$/)) return 'moderation';
  return 'feed';
};

const buildHashPath = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${withBasePath('/')}#${normalizedPath}`;
};

const setBrowserPath = (path, replace = false) => {
  const nextPath = buildHashPath(path);

  if (`${window.location.pathname}${window.location.hash}` !== nextPath) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath);
  }
};

const updateBrowserPath = (path) => setBrowserPath(path);
const replaceBrowserPath = (path) => setBrowserPath(path, true);

const getWallPosts = (profileId, posts) =>
  posts.filter(
    (post) =>
      post.ownerId === profileId ||
      post.likedBy?.includes(profileId) ||
      post.repostedBy?.includes(profileId) ||
      post.bookmarkedBy?.includes(profileId),
  );

const PROFILE_RELOAD_FIELDS = ['avatar', 'avatar_image', 'banner_image', 'bio', 'name', 'role', 'status', 'user_id'];

const shouldReloadForProfileChange = (payload) => {
  if (payload.eventType !== 'UPDATE') {
    return true;
  }

  const oldProfile = payload.old || {};
  const nextProfile = payload.new || {};
  const hasComparableOldProfile = PROFILE_RELOAD_FIELDS.some((field) => Object.hasOwn(oldProfile, field));

  if (!hasComparableOldProfile) {
    return true;
  }

  return PROFILE_RELOAD_FIELDS.some((field) => oldProfile[field] !== nextProfile[field]);
};

export default function AppShell({ authenticatedUser, authError = '', onSignOut = () => {} }) {
  const notificationsRef = useRef(null);
  const settingsRef = useRef(null);
  const remoteReloadTimerRef = useRef(null);
  const [activeView, setActiveView] = useState(getInitialView);
  const [currentUser, setCurrentUser] = useState(authenticatedUser);
  const [selectedProfileKey, setSelectedProfileKey] = useState(() => getProfileKeyFromPath() || authenticatedUser.userId || authenticatedUser.id);
  const [preferredConversationId, setPreferredConversationId] = useState(() => getMessageConversationIdFromPath() || null);
  const [selectedPostId, setSelectedPostId] = useState(() => getPostIdFromPath());
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postsCursor, setPostsCursor] = useState(null);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('all');
  const [activeAuthor, setActiveAuthor] = useState('all');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('default-sqd-density') === 'compact');
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState('');
  const onlineUserIds = useOnlinePresence(currentUser);

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
      const [remoteProfiles, postsPage, remoteNotifications] = await Promise.all([
        fetchProfiles(),
        fetchPostsPage(currentUser.id),
        fetchNotifications(currentUser.id),
      ]);
      let nextPosts = postsPage.posts;

      if (selectedPostId && !nextPosts.some((post) => isSamePostId(post.id, selectedPostId))) {
        const selectedPost = await fetchPostById(currentUser.id, selectedPostId);

        if (selectedPost) {
          nextPosts = [selectedPost, ...nextPosts];
        }
      }

      setPeople(remoteProfiles);
      setPosts(nextPosts);
      setPostsCursor(postsPage.nextCursor);
      setPostsHasMore(postsPage.hasMore);
      setNotifications(remoteNotifications);
    } catch (error) {
      setBackendError(error.message);
    } finally {
      setBackendReady(true);
    }
  }, [currentUser, selectedPostId]);

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
    const scheduleProfileReload = (payload) => {
      if (shouldReloadForProfileChange(payload)) {
        scheduleRemoteReload();
      }
    };

    const channel = supabase
      .channel(`default-sqd-release-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleProfileReload)
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

  const peopleWithPresence = useMemo(
    () => people.map((person) => applyPresenceStatus(person, onlineUserIds)),
    [onlineUserIds, people],
  );

  const currentUserWithPresence = useMemo(
    () => applyPresenceStatus(currentUser, onlineUserIds),
    [currentUser, onlineUserIds],
  );

  const displayedUser = useMemo(() => {
    const freshProfile = peopleWithPresence.find((person) => person.id === currentUserWithPresence?.id) || currentUserWithPresence;
    return getProfileWithStats(freshProfile);
  }, [currentUserWithPresence, getProfileWithStats, peopleWithPresence]);

  const selectedProfile = useMemo(() => {
    const profile = peopleWithPresence.find((person) => person.id === selectedProfileKey || person.userId === selectedProfileKey);

    if (profile) {
      return getProfileWithStats(profile);
    }

    if (selectedProfileKey === displayedUser.id || selectedProfileKey === displayedUser.userId) {
      return displayedUser;
    }

    return null;
  }, [displayedUser, getProfileWithStats, peopleWithPresence, selectedProfileKey]);

  const activeConversationPathId = activeView === 'messages' ? preferredConversationId : null;
  const isMessageConversationOpen = activeView === 'messages' && Boolean(preferredConversationId);
  const profileMissing = activeView === 'profile' && backendReady && !selectedProfile;
  const canModerate = hasModerationAccess(displayedUser);

  const authorFilters = useMemo(
    () => [
      { label: 'Все', value: 'all', caption: 'все авторы' },
      ...peopleWithPresence.map((person) => ({ label: person.name, value: person.id, caption: `@${person.userId}` })),
    ],
    [peopleWithPresence],
  );

  const visiblePosts = useMemo(() => {
    if (selectedPostId) {
      return posts.filter((post) => isSamePostId(post.id, selectedPostId));
    }

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
  }, [activeAuthor, activeTopic, posts, query, selectedPostId]);

  const hashtagTrends = useMemo(() => buildHashtagTrends(posts), [posts]);

  const replacePostsFromMutation = (remotePosts) => {
    setPosts(remotePosts);
    setPostsCursor(remotePosts.at(-1)?.createdAt || null);
    setPostsHasMore(remotePosts.length >= 20);
  };

  const loadMorePosts = async () => {
    if (!postsHasMore || !postsCursor || loadingMorePosts || !currentUser?.id) {
      return;
    }

    try {
      setLoadingMorePosts(true);
      setBackendError('');
      const nextPage = await fetchPostsPage(currentUser.id, { cursor: postsCursor });
      setPosts((items) => {
        const seen = new Set(items.map((post) => String(post.id)));
        return [...items, ...nextPage.posts.filter((post) => !seen.has(String(post.id)))];
      });
      setPostsCursor(nextPage.nextCursor);
      setPostsHasMore(nextPage.hasMore);
    } catch (error) {
      setBackendError(error.message);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const addPost = async ({ hashtags, text }) => {
    const previousPosts = posts;

    try {
      const remotePosts = await createRemotePost({ currentUserId: currentUser.id, hashtags, text });
      replacePostsFromMutation(remotePosts);
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
      replacePostsFromMutation(remotePosts);
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
      replacePostsFromMutation(remotePosts);
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
      replacePostsFromMutation(remotePosts);
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
      replacePostsFromMutation(remotePosts);
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
      replacePostsFromMutation(remotePosts);
    } catch (error) {
      setPosts(previousPosts);
      throw error;
    }
  };

  const updateProfile = async (updater) => {
    const previousUserId = displayedUser.userId;
    const nextProfile = typeof updater === 'function' ? updater(displayedUser) : updater;
    const remoteProfile = await updateRemoteProfile(nextProfile);
    setCurrentUser(remoteProfile);

    if (remoteProfile.id === currentUser.id && remoteProfile.userId !== previousUserId) {
      setSelectedProfileKey(remoteProfile.userId);

      if (activeView === 'profile') {
        updateBrowserPath(`/profile/${encodeURIComponent(remoteProfile.userId)}`);
      }
    }

    await loadRemoteData();
  };

  const uploadProfileMedia = async ({ blob, field }) =>
    uploadRemoteProfileImage({ blob, currentUserId: currentUser.id, field });

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
      replacePostsFromMutation(remotePosts);
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
    setSelectedPostId(null);
    updateBrowserPath(conversationId ? `/messages/${encodeURIComponent(conversationId)}` : '/messages');
  }, []);

  const showPost = (postId) => {
    if (!postId) {
      return;
    }

    setPreferredConversationId(null);
    setSelectedPostId(postId);
    setActiveTopic('all');
    setActiveAuthor('all');
    setQuery('');
    setActiveView('feed');
    updateBrowserPath(`/post/${encodeURIComponent(postId)}`);
  };

  const showProfile = (profileId = currentUser.id) => {
    setPreferredConversationId(null);
    setSelectedPostId(null);
    const profile = peopleWithPresence.find((person) => person.id === profileId || person.userId === profileId);
    const isOwnProfile = profileId === currentUser.id || profileId === currentUser.userId;
    const profileKey = profile?.userId || (isOwnProfile ? displayedUser.userId : profileId);
    setSelectedProfileKey(profileKey);
    setActiveView('profile');
    updateBrowserPath(`/profile/${encodeURIComponent(profileKey)}`);
  };
  const showOwnProfile = () => showProfile(currentUser.id);
  const showFeed = () => {
    setPreferredConversationId(null);
    setSelectedPostId(null);
    setActiveTopic('all');
    setActiveAuthor('all');
    setQuery('');
    setActiveView('feed');
    updateBrowserPath('/');
  };
  const navigateView = (target) => {
    if (target === 'moderation') {
      showModeration();
      return;
    }

    if (target === 'profile') {
      showOwnProfile();
      return;
    }

    if (target === 'messages') {
      showMessages(null);
      return;
    }

    showFeed();
  };

  const handleConversationChange = useCallback((conversationId) => {
    setSelectedPostId(null);
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
    setSelectedPostId(null);
    setActiveTopic(topic);
    setActiveAuthor('all');
    setActiveView('feed');
    updateBrowserPath('/');
  };

  const selectAuthor = (authorId) => {
    setPreferredConversationId(null);
    setSelectedPostId(null);
    setActiveAuthor(authorId);
    setActiveTopic('all');
    setActiveView('feed');
    updateBrowserPath('/');
  };

  const openReportDialog = (target) => {
    setReportError('');
    setReportTarget(target);
  };

  const submitReport = async (reason) => {
    if (!reportTarget || reportBusy) {
      return;
    }

    try {
      setReportBusy(true);
      setReportError('');
      await reportContent({ ...reportTarget, reason });
      setReportTarget(null);
    } catch (error) {
      setReportError(error.message);
    } finally {
      setReportBusy(false);
    }
  };

  const showModeration = () => {
    if (!canModerate) {
      return;
    }
    setPreferredConversationId(null);
    setSelectedPostId(null);
    setActiveView('moderation');
    updateBrowserPath('/moderation');
  };

  const openModerationForUser = () => {
    if (!canModerate) {
      return;
    }
    showModeration();
  };

  const openNotification = (item) => {
    setNotificationsOpen(false);

    if (item.conversationId) {
      showMessages(item.conversationId);
      return;
    }

    if (item.postId) {
      showPost(item.postId);
      return;
    }

    if (item.actorId) {
      showProfile(item.actorId);
    }
  };

  useEffect(() => {
    const syncRoute = () => {
      const appPath = getAppPath();
      const profileKey = getProfileKeyFromPath();
      const conversationId = getMessageConversationIdFromPath();
      const postId = getPostIdFromPath();

      if (!getHashAppPath() && appPath !== '/') {
        replaceBrowserPath(appPath);
      }

      if (profileKey) {
        setSelectedPostId(null);
        setSelectedProfileKey(profileKey);
        setActiveView('profile');
        return;
      }

      if (appPath.match(/^\/moderation\/?$/) && canModerate) {
        setSelectedPostId(null);
        setPreferredConversationId(null);
        setActiveView('moderation');
        return;
      }

      if (conversationId !== null) {
        setSelectedPostId(null);
        setPreferredConversationId(conversationId || null);
        setActiveView('messages');
        return;
      }

      setPreferredConversationId(null);
      setSelectedPostId(postId);
      setActiveView('feed');
    };

    syncRoute();

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);

    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, [canModerate]);

  const displayedMobileNavigation = canModerate ? [...mobileNavigation, { icon: ShieldAlert, label: 'Модерация', target: 'moderation' }] : mobileNavigation;

  return (
    <div
      className={[
        'poster-app min-h-screen px-3 pb-24 pt-3 text-text sm:px-5 sm:py-5 lg:px-8',
        activeView === 'messages' ? 'poster-app--messages' : '',
        isMessageConversationOpen ? 'poster-app--chat-open' : '',
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

        {activeView === 'feed' && !selectedPostId ? (
          <label className="ml-auto hidden min-w-56 items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text-soft transition focus-within:border-border-strong lg:flex">
            <Search size={16} strokeWidth={1.8} />
            <input
              className="w-full border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              name="feed-search-desktop"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по ленте"
              type="search"
              value={query}
            />
          </label>
        ) : (
          <span className="ml-auto" aria-hidden="true" />
        )}

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
                      <button className="min-w-0 flex-1 text-left" onClick={() => openNotification(item)} type="button">
                        <p className="leading-5">{item.text}</p>
                        <p className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted">{item.time}</p>
                      </button>
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

        {canModerate ? (
          <IconButton active={activeView === 'moderation'} icon={ShieldAlert} label="Модерация" onClick={showModeration} />
        ) : null}

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
                  name="compact-mode"
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

      {activeView === 'feed' && !selectedPostId ? (
        <label className="poster-mobile-search mx-auto mb-5 flex max-w-[var(--shell-width)] items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/75 px-3 py-2 text-text-soft shadow-[var(--shadow-panel)] transition focus-within:border-border-strong lg:hidden">
          <Search size={16} strokeWidth={1.8} />
          <input
            className="w-full border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
            name="feed-search-mobile"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по ленте"
            type="search"
            value={query}
          />
        </label>
      ) : null}

      {displayedBackendError ? (
        <div className="mx-auto mb-4 max-w-[var(--shell-width)] rounded-sqd-sm border border-warning/45 bg-warning/10 px-3 py-2 font-ui text-sm text-warning">
          {displayedBackendError}
        </div>
      ) : null}

      {!backendReady ? (
        <div className="mx-auto mb-4 grid max-w-[var(--shell-width)] gap-3" aria-label="Загружаем данные">
          <div className="skeleton-line h-14 rounded-sqd-sm" />
          <div className="skeleton-line h-28 rounded-sqd-sm" />
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

        <Suspense fallback={<Panel className="p-6"><div className="skeleton-line h-24 rounded-sqd-sm" /></Panel>}>
          {activeView === 'messages' ? (
            <MessagesPanel
              currentUser={displayedUser}
              onReport={openReportDialog}
              expanded
              onConversationPathChange={handleConversationChange}
              onOpenProfile={showProfile}
              onPreferredConversationHandled={clearPreferredConversation}
              people={peopleWithPresence}
              preferredConversationId={activeConversationPathId}
            />
          ) : activeView === 'moderation' && canModerate ? (
            <ModerationPanel
              currentUser={displayedUser}
              onOpenProfile={showProfile}
              people={peopleWithPresence}
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
              onUploadProfileImage={uploadProfileMedia}
              people={peopleWithPresence}
              posts={posts}
              profileUser={selectedProfile}
              requestedProfileKey={selectedProfileKey}
            />
          ) : (
            <Feed
              activeAuthor={activeAuthor}
              activeTopic={activeTopic}
              authors={authorFilters}
              compactMode={compactMode}
              currentUser={displayedUser}
              hasMore={postsHasMore && !selectedPostId}
              loadingMore={loadingMorePosts}
              onAddPost={addPost}
              onClearPost={showFeed}
              onClearTopic={() => setActiveTopic('all')}
              onCommentPost={addComment}
              onDeleteComment={deleteComment}
              onDeletePost={deletePost}
              onLoadMore={loadMorePosts}
              onOpenProfile={showProfile}
              onModerateUser={openModerationForUser}
              onReport={openReportDialog}
              onSelectAuthor={selectAuthor}
              onTogglePost={togglePost}
              onUpdateComment={updateComment}
              onUpdatePost={updatePost}
              posts={visiblePosts}
              query={query}
              selectedPostId={selectedPostId}
            />
          )}
        </Suspense>
      </main>

      <ReportDialog
        busy={reportBusy}
        error={reportError}
        onCancel={() => setReportTarget(null)}
        onSubmit={submitReport}
        open={Boolean(reportTarget)}
        targetLabel={reportTarget?.targetLabel}
      />

      <nav className={[
        'fixed inset-x-3 bottom-3 z-50 grid gap-2 rounded-sqd-md border border-border bg-bg-soft/95 p-2 shadow-[var(--shadow-panel)] backdrop-blur-md lg:hidden',
        canModerate ? 'grid-cols-4' : 'grid-cols-3',
        isMessageConversationOpen ? 'hidden' : '',
      ].join(' ')} aria-label="Мобильная навигация">
        {displayedMobileNavigation.map((item) => {
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

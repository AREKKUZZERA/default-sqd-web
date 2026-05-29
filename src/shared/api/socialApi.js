import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export { isSupabaseConfigured };

const REACTION_TO_FIELD = {
  like: 'liked',
  repost: 'reposted',
  bookmark: 'bookmarked',
};

const NOTIFICATION_LABELS = {
  comment: 'ответил(а) на ваш пост',
  like: 'поставил(а) лайк',
  repost: 'сделал(а) репост',
  bookmark: 'добавил(а) пост в избранное',
  message: 'написал(а) сообщение',
};

const MEDIA_BUCKET = 'avatars';
const POST_PAGE_SIZE = 20;
const SIGNED_MEDIA_TTL = 60 * 60;
const SIGNED_MEDIA_CACHE_GRACE_SECONDS = 5 * 60;
const STORAGE_OBJECT_PREFIXES = [
  `/storage/v1/object/public/${MEDIA_BUCKET}/`,
  `/storage/v1/object/sign/${MEDIA_BUCKET}/`,
  `/storage/v1/object/authenticated/${MEDIA_BUCKET}/`,
  `/storage/v1/object/${MEDIA_BUCKET}/`,
];
const signedMediaCache = new Map();

const isRemoteOrInlineImage = (value = '') => /^(?:data:|blob:|https?:\/\/)/i.test(value);

const normalizeProfileMediaPath = (value = '') => {
  if (!value || !isRemoteOrInlineImage(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const prefix = STORAGE_OBJECT_PREFIXES.find((item) => url.pathname.startsWith(item));

    if (!prefix) {
      return value;
    }

    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return value;
  }
};

const collectProfileMediaPaths = (profiles = []) => {
  const paths = [];

  profiles.forEach((profile) => {
    [profile?.avatar_image, profile?.banner_image].forEach((value) => {
      const path = normalizeProfileMediaPath(value);

      if (path && !isRemoteOrInlineImage(path)) {
        paths.push(path);
      }
    });
  });

  return paths;
};

const getSignedMediaMap = async (paths = []) => {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));

  if (!isSupabaseConfigured || uniquePaths.length === 0) {
    return new Map();
  }

  const now = Date.now();
  const mediaMap = new Map();
  const missingPaths = [];

  uniquePaths.forEach((path) => {
    const cached = signedMediaCache.get(path);

    if (cached && cached.expiresAt > now) {
      mediaMap.set(path, cached.signedUrl);
      return;
    }

    missingPaths.push(path);
  });

  if (missingPaths.length === 0) {
    return mediaMap;
  }

  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(missingPaths, SIGNED_MEDIA_TTL);

  if (error) {
    return mediaMap;
  }

  const expiresAt = now + Math.max(0, SIGNED_MEDIA_TTL - SIGNED_MEDIA_CACHE_GRACE_SECONDS) * 1000;

  (data || [])
    .filter((item) => item?.path && item?.signedUrl)
    .forEach((item) => {
      signedMediaCache.set(item.path, { expiresAt, signedUrl: item.signedUrl });
      mediaMap.set(item.path, item.signedUrl);
    });

  return mediaMap;
};

const resolveMediaUrl = (value = '', mediaMap = new Map()) => {
  const path = normalizeProfileMediaPath(value);

  if (!path) {
    return '';
  }

  if (isRemoteOrInlineImage(path)) {
    return path;
  }

  return mediaMap.get(path) || '';
};

const getErrorMessage = (error) => error?.message || 'Supabase request failed';

const toTimeLabel = (value) => {
  if (!value) {
    return 'сейчас';
  }

  const created = new Date(value).getTime();
  const diffMs = Date.now() - created;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) return 'сейчас';
  if (minutes < 60) return `${minutes} мин`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;

  const days = Math.floor(hours / 24);
  return `${days} д`;
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => String(tag).trim().replace(/^#+/, '').toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);
};

const getInitials = (name) =>
  String(name || 'SQ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export const mapProfile = (profile = {}, mediaMap = new Map()) => {
  const name = profile.name || profile.user_id || 'Squad user';
  const avatarImagePath = normalizeProfileMediaPath(profile.avatar_image || '');
  const bannerImagePath = normalizeProfileMediaPath(profile.banner_image || '');

  return {
    id: profile.id,
    userId: profile.user_id || 'squad',
    name,
    role: profile.role || 'Member',
    avatar: profile.avatar || getInitials(name),
    avatarImage: resolveMediaUrl(avatarImagePath, mediaMap),
    avatarImagePath,
    bannerImage: resolveMediaUrl(bannerImagePath, mediaMap),
    bannerImagePath,
    status: profile.status || 'online',
    lastSeenAt: profile.last_seen_at || null,
    bio: profile.bio || '',
    stats: [],
  };
};

const mapComment = (comment, mediaMap = new Map()) => {
  const author = comment.author || comment.profiles || {};

  return {
    id: comment.id,
    authorId: author.id,
    author: author.name || 'Squad user',
    userId: author.user_id || 'squad',
    avatar: author.avatar || getInitials(author.name),
    avatarImage: resolveMediaUrl(author.avatar_image || '', mediaMap),
    avatarImagePath: author.avatar_image || '',
    createdAt: comment.created_at,
    edited: Boolean(comment.updated_at && comment.created_at && comment.updated_at !== comment.created_at),
    text: comment.text,
    time: toTimeLabel(comment.created_at),
  };
};

const mapPost = (post, currentUserId, mediaMap = new Map()) => {
  const author = post.author || post.profiles || {};
  const reactions = post.reactions || post.post_reactions || [];
  const comments = post.comments || [];
  const reactionCounts = reactions.reduce(
    (acc, reaction) => {
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    },
    { like: 0, repost: 0, bookmark: 0 },
  );

  const ownReactions = new Set(
    reactions
      .filter((reaction) => reaction.user_id === currentUserId)
      .map((reaction) => reaction.type),
  );
  const tags = normalizeTags(post.tags);

  return {
    id: post.id,
    ownerId: post.owner_id,
    author: author.name || 'Squad user',
    userId: author.user_id || 'squad',
    avatar: author.avatar || getInitials(author.name),
    avatarImage: resolveMediaUrl(author.avatar_image || '', mediaMap),
    avatarImagePath: author.avatar_image || '',
    edited: Boolean(post.updated_at && post.created_at && post.updated_at !== post.created_at),
    time: toTimeLabel(post.created_at),
    text: post.text,
    tag: tags[0],
    tags,
    likes: reactionCounts.like || 0,
    replies: comments.length,
    reposts: reactionCounts.repost || 0,
    likedBy: reactions.filter((reaction) => reaction.type === 'like').map((reaction) => reaction.user_id),
    repostedBy: reactions.filter((reaction) => reaction.type === 'repost').map((reaction) => reaction.user_id),
    bookmarkedBy: reactions.filter((reaction) => reaction.type === 'bookmark').map((reaction) => reaction.user_id),
    liked: ownReactions.has('like'),
    reposted: ownReactions.has('repost'),
    bookmarked: ownReactions.has('bookmark'),
    comments: comments.map((comment) => mapComment(comment, mediaMap)),
    createdAt: post.created_at,
  };
};

const mapNotification = (notification, mediaMap = new Map(), messageConversationMap = new Map()) => {
  const actor = notification.actor || notification.profiles || {};
  const actorName = actor.name || 'Участник';
  const body = notification.text || `${actorName} ${NOTIFICATION_LABELS[notification.type] || 'обновил(а) активность'}`;

  return {
    id: notification.id,
    actorId: notification.actor_id,
    actorName,
    actorAvatar: actor.avatar || getInitials(actorName),
    actorAvatarImage: resolveMediaUrl(actor.avatar_image || '', mediaMap),
    actorAvatarImagePath: actor.avatar_image || '',
    type: notification.type,
    text: body,
    postId: notification.post_id,
    commentId: notification.comment_id,
    messageId: notification.message_id,
    conversationId: notification.message_id ? messageConversationMap.get(notification.message_id) || null : null,
    readAt: notification.read_at,
    time: toTimeLabel(notification.created_at),
    createdAt: notification.created_at,
  };
};

const mapConversation = (conversation, currentUserId, mediaMap = new Map()) => {
  const members = conversation.members || conversation.direct_conversation_members || [];
  const otherMember = members.find((member) => member.user_id !== currentUserId) || members[0];
  const participant = otherMember?.profile ? mapProfile(otherMember.profile, mediaMap) : null;
  const messages = conversation.messages || conversation.direct_messages || [];
  const lastMessage = messages[0];
  const ownMember = members.find((member) => member.user_id === currentUserId);
  const lastMessageTime = lastMessage?.created_at ? new Date(lastMessage.created_at).getTime() : 0;
  const readTime = ownMember?.read_at ? new Date(ownMember.read_at).getTime() : 0;
  const unread = lastMessage && lastMessage.sender_id !== currentUserId && lastMessageTime > readTime ? 1 : 0;

  return {
    id: conversation.id,
    participantId: participant?.id,
    participant,
    message: lastMessage?.text || 'Диалог создан. Сообщений пока нет.',
    time: toTimeLabel(lastMessage?.created_at || conversation.created_at),
    unread,
  };
};

const mapMessage = (message) => ({
  id: message.id,
  authorId: message.sender_id,
  body: message.text,
  time: toTimeLabel(message.created_at),
  createdAt: message.created_at,
  edited: Boolean(message.updated_at && message.created_at && message.updated_at !== message.created_at),
});

const collectPostMediaPaths = (posts = []) => {
  const profiles = [];

  posts.forEach((post) => {
    if (post.author) {
      profiles.push(post.author);
    }

    (post.comments || []).forEach((comment) => {
      if (comment.author) {
        profiles.push(comment.author);
      }
    });
  });

  return collectProfileMediaPaths(profiles);
};

const collectConversationMediaPaths = (conversations = []) => {
  const profiles = [];

  conversations.forEach((conversation) => {
    (conversation.members || conversation.direct_conversation_members || []).forEach((member) => {
      if (member.profile) {
        profiles.push(member.profile);
      }
    });
  });

  return collectProfileMediaPaths(profiles);
};

const collectNotificationMediaPaths = (notifications = []) =>
  collectProfileMediaPaths(notifications.map((notification) => notification.actor).filter(Boolean));

export async function fetchProfiles() {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, name, role, avatar, avatar_image, banner_image, status, last_seen_at, bio')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const mediaMap = await getSignedMediaMap(collectProfileMediaPaths(data));
  return data.map((profile) => mapProfile(profile, mediaMap));
}

export async function fetchPostsPage(currentUserId, { cursor = null, limit = POST_PAGE_SIZE } = {}) {
  if (!isSupabaseConfigured) {
    return { hasMore: false, nextCursor: null, posts: [] };
  }

  let query = supabase
    .from('posts')
    .select(`
      id,
      owner_id,
      text,
      tags,
      created_at,
      updated_at,
      author:profiles!posts_owner_id_fkey (
        id,
        user_id,
        name,
        avatar,
        avatar_image
      ),
      comments (
        id,
        text,
        created_at,
        updated_at,
        author:profiles!comments_author_id_fkey (
          id,
          user_id,
          name,
          role,
          avatar,
          avatar_image
        )
      ),
      reactions:post_reactions (
        user_id,
        type
      )
    `)
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'comments', ascending: true })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const pageRows = (data || []).slice(0, limit);
  const mediaMap = await getSignedMediaMap(collectPostMediaPaths(pageRows));
  const posts = pageRows.map((post) => mapPost(post, currentUserId, mediaMap));
  const lastPost = posts[posts.length - 1];

  return {
    hasMore: (data || []).length > limit,
    nextCursor: lastPost?.createdAt || null,
    posts,
  };
}

export async function fetchPosts(currentUserId) {
  const page = await fetchPostsPage(currentUserId);
  return page.posts;
}

export async function fetchPostById(currentUserId, postId) {
  if (!isSupabaseConfigured || !postId) {
    return null;
  }

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      owner_id,
      text,
      tags,
      created_at,
      updated_at,
      author:profiles!posts_owner_id_fkey (
        id,
        user_id,
        name,
        avatar,
        avatar_image
      ),
      comments (
        id,
        text,
        created_at,
        updated_at,
        author:profiles!comments_author_id_fkey (
          id,
          user_id,
          name,
          role,
          avatar,
          avatar_image
        )
      ),
      reactions:post_reactions (
        user_id,
        type
      )
    `)
    .eq('id', postId)
    .order('created_at', { referencedTable: 'comments', ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  if (!data) {
    return null;
  }

  const mediaMap = await getSignedMediaMap(collectPostMediaPaths([data]));
  return mapPost(data, currentUserId, mediaMap);
}

export async function createPost({ currentUserId, hashtags, text }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error('Пост не может быть пустым.');
  }

  const { error } = await supabase.from('posts').insert({
    owner_id: currentUserId,
    text: cleanText,
    tags: normalizeTags(hashtags),
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function updatePost({ currentUserId, hashtags, postId, text }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error('Пост не может быть пустым.');
  }

  const { error } = await supabase
    .from('posts')
    .update({
      tags: normalizeTags(hashtags),
      text: cleanText,
    })
    .eq('id', postId)
    .eq('owner_id', currentUserId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function createComment({ currentUserId, postId, text }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error('Комментарий не может быть пустым.');
  }

  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    author_id: currentUserId,
    text: cleanText,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function deletePost({ currentUserId, postId }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('owner_id', currentUserId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function deleteComment({ commentId, currentUserId }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', currentUserId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function updateComment({ commentId, currentUserId, text }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error('Комментарий не может быть пустым.');
  }

  const { error } = await supabase
    .from('comments')
    .update({ text: cleanText })
    .eq('id', commentId)
    .eq('author_id', currentUserId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function toggleReaction({ active, currentUserId, postId, type }) {
  if (!isSupabaseConfigured) {
    return [];
  }

  if (active) {
    const { error } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', currentUserId)
      .eq('type', type);

    if (error) {
      throw new Error(getErrorMessage(error));
    }
  } else {
    const { error } = await supabase
      .from('post_reactions')
      .upsert({ post_id: postId, user_id: currentUserId, type }, { onConflict: 'post_id,user_id,type' });

    if (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  return fetchPosts(currentUserId);
}

export async function updateProfile(profile) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      user_id: profile.userId,
      name: profile.name,
      avatar: profile.avatar,
      avatar_image: profile.avatarImagePath ?? profile.avatarImage ?? '',
      banner_image: profile.bannerImagePath ?? profile.bannerImage ?? '',
      status: profile.status,
      bio: profile.bio,
    })
    .eq('id', profile.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const mediaMap = await getSignedMediaMap(collectProfileMediaPaths([data]));
  return mapProfile(data, mediaMap);
}

export async function uploadProfileImage({ blob, currentUserId, field }) {
  if (!isSupabaseConfigured) {
    return '';
  }

  if (!blob || !currentUserId) {
    throw new Error('Image upload failed.');
  }

  const filename = field === 'bannerImage' ? 'banner.webp' : 'avatar.webp';
  const path = `${currentUserId}/${filename}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: true,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return path;
}

export async function fetchNotifications(currentUserId) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id,
      recipient_id,
      actor_id,
      type,
      post_id,
      comment_id,
      message_id,
      text,
      read_at,
      created_at,
      actor:profiles!notifications_actor_id_fkey (
        id,
        user_id,
        name,
        avatar,
        avatar_image
      )
    `)
    .eq('recipient_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const messageIds = Array.from(new Set((data || []).map((item) => item.message_id).filter(Boolean)));
  let messageConversationMap = new Map();

  if (messageIds.length > 0) {
    const { data: messages, error: messageError } = await supabase
      .from('direct_messages')
      .select('id, conversation_id')
      .in('id', messageIds);

    if (!messageError) {
      messageConversationMap = new Map((messages || []).map((message) => [message.id, message.conversation_id]));
    }
  }

  const mediaMap = await getSignedMediaMap(collectNotificationMediaPaths(data));
  return data.map((notification) => mapNotification(notification, mediaMap, messageConversationMap));
}

export async function markNotificationsRead(currentUserId) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', currentUserId)
    .is('read_at', null);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchNotifications(currentUserId);
}

export async function fetchConversations(currentUserId) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('direct_conversations')
    .select(`
      id,
      created_at,
      members:direct_conversation_members (
        user_id,
        read_at,
        profile:profiles!direct_conversation_members_user_id_fkey (
          id,
          user_id,
          name,
          role,
          avatar,
          avatar_image,
          banner_image,
          status,
          last_seen_at,
          bio
        )
      ),
      messages:direct_messages (
        id,
        sender_id,
        text,
        created_at,
        updated_at
      )
    `)
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'direct_messages', ascending: false })
    .limit(1, { referencedTable: 'direct_messages' });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const mediaMap = await getSignedMediaMap(collectConversationMediaPaths(data));
  return data.map((conversation) => mapConversation(conversation, currentUserId, mediaMap));
}

export async function fetchMessages(conversationId, { before, limit = 50 } = {}) {
  if (!isSupabaseConfigured || !conversationId) {
    return { hasMore: false, messages: [] };
  }

  let query = supabase
    .from('direct_messages')
    .select('id, conversation_id, sender_id, text, created_at, updated_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return {
    hasMore: data.length > limit,
    messages: data.slice(0, limit).reverse().map(mapMessage),
  };
}

export async function createDirectConversation(currentUserId, participantId) {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!currentUserId || !participantId) {
    throw new Error('Не удалось определить участников диалога.');
  }

  if (currentUserId === participantId) {
    throw new Error('Нельзя создать диалог с самим собой.');
  }

  const { data, error } = await supabase.rpc('create_direct_conversation', {
    target_user_id: participantId,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data;
}

export async function sendDirectMessage({ conversationId, currentUserId, text }) {
  if (!isSupabaseConfigured) {
    return { hasMore: false, messages: [] };
  }

  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error('Сообщение не может быть пустым.');
  }

  const { error } = await supabase.from('direct_messages').insert({
    conversation_id: conversationId,
    sender_id: currentUserId,
    text: cleanText,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchMessages(conversationId);
}

export async function updateDirectMessage({ conversationId, currentUserId, messageId, text }) {
  if (!isSupabaseConfigured) {
    return { hasMore: false, messages: [] };
  }

  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error('Сообщение не может быть пустым.');
  }

  const { error } = await supabase
    .from('direct_messages')
    .update({ text: cleanText })
    .eq('id', messageId)
    .eq('sender_id', currentUserId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchMessages(conversationId);
}

export async function deleteDirectMessage({ conversationId, currentUserId, messageId }) {
  if (!isSupabaseConfigured) {
    return { hasMore: false, messages: [] };
  }

  const { error } = await supabase
    .from('direct_messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', currentUserId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchMessages(conversationId);
}

export async function markConversationRead({ conversationId, currentUserId }) {
  if (!isSupabaseConfigured || !conversationId) {
    return;
  }

  const { error } = await supabase
    .from('direct_conversation_members')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', currentUserId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export function getReactionTypeByKey(key) {
  return Object.entries(REACTION_TO_FIELD).find(([, field]) => field === key)?.[0];
}

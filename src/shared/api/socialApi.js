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

export const mapProfile = (profile = {}) => {
  const name = profile.name || profile.user_id || 'Squad user';

  return {
    id: profile.id,
    userId: profile.user_id || 'squad',
    name,
    role: profile.role || 'Member',
    avatar: profile.avatar || getInitials(name),
    avatarImage: profile.avatar_image || '',
    bannerImage: profile.banner_image || '',
    status: profile.status || 'online',
    bio: profile.bio || '',
    stats: [],
  };
};

const mapComment = (comment) => {
  const author = comment.author || comment.profiles || {};

  return {
    id: comment.id,
    author: author.name || 'Squad user',
    avatar: author.avatar || getInitials(author.name),
    avatarImage: author.avatar_image || '',
    text: comment.text,
    time: toTimeLabel(comment.created_at),
  };
};

const mapPost = (post, currentUserId) => {
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
    avatarImage: author.avatar_image || '',
    time: toTimeLabel(post.created_at),
    text: post.text,
    mediaAttached: Boolean(post.media_attached),
    tag: tags[0],
    tags,
    likes: reactionCounts.like || 0,
    replies: comments.length,
    reposts: reactionCounts.repost || 0,
    liked: ownReactions.has('like'),
    reposted: ownReactions.has('repost'),
    bookmarked: ownReactions.has('bookmark'),
    comments: comments.map(mapComment),
  };
};

const mapNotification = (notification) => {
  const actor = notification.actor || notification.profiles || {};
  const actorName = actor.name || 'Участник';
  const body = notification.text || `${actorName} ${NOTIFICATION_LABELS[notification.type] || 'обновил(а) активность'}`;

  return {
    id: notification.id,
    actorId: notification.actor_id,
    actorName,
    actorAvatar: actor.avatar || getInitials(actorName),
    actorAvatarImage: actor.avatar_image || '',
    type: notification.type,
    text: body,
    postId: notification.post_id,
    readAt: notification.read_at,
    time: toTimeLabel(notification.created_at),
    createdAt: notification.created_at,
  };
};

const mapConversation = (conversation, currentUserId) => {
  const members = conversation.members || conversation.direct_conversation_members || [];
  const otherMember = members.find((member) => member.user_id !== currentUserId) || members[0];
  const participant = otherMember?.profile ? mapProfile(otherMember.profile) : null;
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
});

export async function fetchProfiles() {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, name, role, avatar, avatar_image, banner_image, status, bio')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.map(mapProfile);
}

export async function fetchPosts(currentUserId) {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      owner_id,
      text,
      media_attached,
      tags,
      created_at,
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
        author:profiles!comments_author_id_fkey (
          id,
          user_id,
          name,
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
    .order('created_at', { referencedTable: 'comments', ascending: true });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.map((post) => mapPost(post, currentUserId));
}

export async function createPost({ currentUserId, hashtags, mediaAttached = false, text }) {
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
    media_attached: mediaAttached,
    tags: normalizeTags(hashtags),
  });

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
      role: profile.role,
      avatar: profile.avatar,
      avatar_image: profile.avatarImage,
      banner_image: profile.bannerImage,
      status: profile.status,
      bio: profile.bio,
    })
    .eq('id', profile.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return mapProfile(data);
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

  return data.map(mapNotification);
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
          bio
        )
      ),
      messages:direct_messages (
        id,
        sender_id,
        text,
        created_at
      )
    `)
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'direct_messages', ascending: false })
    .limit(1, { referencedTable: 'direct_messages' });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.map((conversation) => mapConversation(conversation, currentUserId));
}

export async function fetchMessages(conversationId) {
  if (!isSupabaseConfigured || !conversationId) {
    return [];
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, conversation_id, sender_id, text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.map(mapMessage);
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
    return [];
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

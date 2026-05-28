import { currentUser as seedUser } from '../data/socialData.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export { isSupabaseConfigured };

const REACTION_TO_FIELD = {
  like: 'liked',
  repost: 'reposted',
  bookmark: 'bookmarked',
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

  return tags
    .map((tag) => String(tag).trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);
};

const mapProfile = (profile = seedUser) => ({
  id: profile.id,
  userId: profile.user_id || profile.userId,
  name: profile.name,
  role: profile.role || seedUser.role,
  avatar: profile.avatar || profile.name?.slice(0, 2).toUpperCase() || 'SQ',
  avatarImage: profile.avatar_image || profile.avatarImage || '',
  bannerImage: profile.banner_image || profile.bannerImage || '',
  status: profile.status || 'online',
  bio: profile.bio || '',
  stats: [],
});

const mapComment = (comment) => {
  const author = comment.author || comment.profiles || seedUser;

  return {
    id: comment.id,
    author: author.name,
    avatar: author.avatar,
    avatarImage: author.avatar_image || author.avatarImage || '',
    text: comment.text,
  };
};

const mapPost = (post, currentUserId) => {
  const author = post.author || post.profiles || seedUser;
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
    author: author.name,
    userId: author.user_id,
    avatar: author.avatar,
    avatarImage: author.avatar_image || '',
    time: toTimeLabel(post.created_at),
    text: post.text,
    mediaAttached: Boolean(post.media_attached),
    tag: tags[0],
    tags,
    likes: reactionCounts.like || 0,
    replies: 0,
    reposts: reactionCounts.repost || 0,
    liked: ownReactions.has('like'),
    reposted: ownReactions.has('repost'),
    bookmarked: ownReactions.has('bookmark'),
    comments: comments.map(mapComment),
  };
};

export async function ensureDemoProfile() {
  if (!isSupabaseConfigured) {
    return seedUser;
  }

  const profile = {
    id: seedUser.id,
    user_id: seedUser.userId,
    name: seedUser.name,
    role: seedUser.role,
    avatar: seedUser.avatar,
    avatar_image: seedUser.avatarImage,
    banner_image: seedUser.bannerImage,
    status: seedUser.status,
    bio: seedUser.bio,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return mapProfile(data);
}

export async function fetchPosts(currentUserId = seedUser.id) {
  if (!isSupabaseConfigured) {
    return null;
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
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.map((post) => mapPost(post, currentUserId));
}

export async function createPost({ currentUserId = seedUser.id, hashtags, mediaAttached = false, text }) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { error } = await supabase.from('posts').insert({
    owner_id: currentUserId,
    text,
    media_attached: mediaAttached,
    tags: normalizeTags(hashtags),
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function createComment({ currentUserId = seedUser.id, postId, text }) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    author_id: currentUserId,
    text,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return fetchPosts(currentUserId);
}

export async function toggleReaction({ active, currentUserId = seedUser.id, postId, type }) {
  if (!isSupabaseConfigured) {
    return null;
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

export function getReactionTypeByKey(key) {
  return Object.entries(REACTION_TO_FIELD).find(([, field]) => field === key)?.[0];
}

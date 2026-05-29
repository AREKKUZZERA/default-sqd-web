import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { getDisplayRole, getPermissions } from '../utils/permissions.js';

const MEDIA_BUCKET = 'avatars';
const SIGNED_MEDIA_TTL = 60 * 60;

const getErrorMessage = (error) => error?.message || 'Auth request failed';

const withTimeout = (promise, ms = 8000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase request timeout')), ms)
    ),
  ]);

const normalizeUserId = (value, fallback) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);

  return normalized || fallback;
};

const getInitials = (name) =>
  String(name || 'SQ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const isRemoteOrInlineImage = (value = '') => /^(?:data:|blob:|https?:\/\/)/i.test(value);

const getSignedProfileMedia = async (profile = {}) => {
  const paths = [profile.avatar_image, profile.banner_image].filter((value) => value && !isRemoteOrInlineImage(value));

  if (!isSupabaseConfigured || paths.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(Array.from(new Set(paths)), SIGNED_MEDIA_TTL);

  if (error) {
    return new Map();
  }

  return new Map((data || []).filter((item) => item?.path && item?.signedUrl).map((item) => [item.path, item.signedUrl]));
};

export function mapAuthProfile(profile, user) {
  const emailName = user?.email?.split('@')[0] || 'squad';
  const name = profile?.name || user?.user_metadata?.name || user?.user_metadata?.full_name || emailName;
  const avatarImagePath = profile?.avatar_image || '';
  const bannerImagePath = profile?.banner_image || '';
  const mediaMap = profile?.mediaMap || new Map();

  return {
    id: profile?.id || user?.id,
    userId:
      profile?.user_id ||
      normalizeUserId(
        user?.user_metadata?.user_id || emailName,
        `user_${user?.id?.slice(0, 6) || 'sqd'}`
      ),
    name,
    role: getDisplayRole(profile),
    permissions: getPermissions(profile),
    avatar: profile?.avatar || getInitials(name),
    avatarImage: isRemoteOrInlineImage(avatarImagePath) ? avatarImagePath : mediaMap.get(avatarImagePath) || '',
    avatarImagePath,
    bannerImage: isRemoteOrInlineImage(bannerImagePath) ? bannerImagePath : mediaMap.get(bannerImagePath) || '',
    bannerImagePath,
    status: profile?.status || 'online',
    lastSeenAt: profile?.last_seen_at || null,
    bio: profile?.bio || 'Новый участник закрытого пространства DEFAULT SQUAD.',
    stats: [],
  };
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await withTimeout(supabase.auth.getSession(), 8000);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.session;
}

export function listenToAuthChanges(callback) {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword({ email, password }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    }),
    8000
  );

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return data.session;
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    return;
  }

  const { error } = await withTimeout(supabase.auth.signOut(), 8000);

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function ensureProfileForSession(session) {
  if (!isSupabaseConfigured || !session?.user) {
    return null;
  }

  const user = session.user;

  const { data: existing, error: selectError } = await withTimeout(
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(),
    8000
  );

  if (selectError) {
    throw new Error(getErrorMessage(selectError));
  }

  if (existing) {
    const mediaMap = await getSignedProfileMedia(existing);
    return mapAuthProfile({ ...existing, mediaMap }, user);
  }

  const emailName = user.email?.split('@')[0] || `user_${user.id.slice(0, 6)}`;
  const name = user.user_metadata?.name || user.user_metadata?.full_name || emailName;
  const userId = normalizeUserId(
    user.user_metadata?.user_id || emailName,
    `user_${user.id.slice(0, 6)}`
  );

  const baseProfile = {
    id: user.id,
    user_id: userId,
    name,
    avatar: getInitials(name),
    avatar_image: '',
    banner_image: '',
    status: 'online',
    bio: 'Новый участник закрытого пространства DEFAULT SQUAD.',
  };

  const { data, error } = await withTimeout(
    supabase.from('profiles').insert(baseProfile).select('*').single(),
    8000
  );

  if (!error) {
    const mediaMap = await getSignedProfileMedia(data);
    return mapAuthProfile({ ...data, mediaMap }, user);
  }

  if (error.code === '23505') {
    const retryProfile = {
      ...baseProfile,
      user_id: `${userId}_${user.id.slice(0, 6)}`,
    };

    const { data: retryData, error: retryError } = await withTimeout(
      supabase.from('profiles').insert(retryProfile).select('*').single(),
      8000
    );

    if (retryError) {
      throw new Error(getErrorMessage(retryError));
    }

    const mediaMap = await getSignedProfileMedia(retryData);
    return mapAuthProfile({ ...retryData, mediaMap }, user);
  }

  throw new Error(getErrorMessage(error));
}

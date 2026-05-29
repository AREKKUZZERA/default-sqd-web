import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

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

export function mapAuthProfile(profile, user) {
  const emailName = user?.email?.split('@')[0] || 'squad';
  const name = profile?.name || user?.user_metadata?.name || user?.user_metadata?.full_name || emailName;

  return {
    id: profile?.id || user?.id,
    userId:
      profile?.user_id ||
      normalizeUserId(
        user?.user_metadata?.user_id || emailName,
        `user_${user?.id?.slice(0, 6) || 'sqd'}`
      ),
    name,
    role: profile?.role || 'Member',
    avatar: profile?.avatar || getInitials(name),
    avatarImage: profile?.avatar_image || '',
    bannerImage: profile?.banner_image || '',
    status: profile?.status || 'online',
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
    return mapAuthProfile(existing, user);
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
    return mapAuthProfile(data, user);
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

    return mapAuthProfile(retryData, user);
  }

  throw new Error(getErrorMessage(error));
}
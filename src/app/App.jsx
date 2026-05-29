import { useCallback, useEffect, useState } from 'react';
import AuthScreen from '../features/auth/AuthScreen.jsx';
import {
  ensureProfileForSession,
  getCurrentSession,
  listenToAuthChanges,
  signInWithPassword,
  signOut as signOutRemote,
} from '../shared/api/authApi.js';
import { isSupabaseConfigured } from '../shared/lib/supabase.js';
import AppShell from './AppShell.jsx';

export default function App() {
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState(null);

  const loadProfile = useCallback(async (session) => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      setAuthLoading(false);
      return;
    }

    if (!session) {
      setProfile(null);
      setAuthLoading(false);
      return;
    }

    try {
      setAuthError('');
      const nextProfile = await ensureProfileForSession(session);
      setProfile(nextProfile);
    } catch (error) {
      setAuthError(error.message);
      setProfile(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const session = await getCurrentSession();

        if (mounted) {
          await loadProfile(session);
        }
      } catch (error) {
        if (mounted) {
          setAuthError(error.message);
          setAuthLoading(false);
        }
      }
    };

    void boot();

    const unsubscribe = listenToAuthChanges((session) => {
      void loadProfile(session);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadProfile]);

  const handleSignIn = async ({ email, password }) => {
    setAuthError('');
    setAuthLoading(true);
    const session = await signInWithPassword({ email, password });
    await loadProfile(session);
  };

  const handleSignOut = async () => {
    try {
      setAuthError('');
      await signOutRemote();
      setProfile(null);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <AuthScreen
        error="Вход временно недоступен. Сообщите администратору проекта."
        loading={false}
        onSignIn={() => {}}
        supabaseReady={false}
      />
    );
  }

  if (!profile) {
    return (
      <AuthScreen
        error={authError}
        loading={authLoading}
        onSignIn={handleSignIn}
        supabaseReady={isSupabaseConfigured}
      />
    );
  }

  return <AppShell authenticatedUser={profile} authError={authError} onSignOut={handleSignOut} />;
}

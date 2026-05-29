import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const LAST_SEEN_INTERVAL_MS = 45000;
const ONLINE_CHANNEL = 'default-sqd-online';

const flattenPresenceState = (state) =>
  Object.values(state || {})
    .flat()
    .map((item) => item?.userId)
    .filter(Boolean);

async function updateLastSeen(userId) {
  if (!userId) {
    return;
  }

  await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId);
}

function safeUpdateLastSeen(userId) {
  void updateLastSeen(userId).catch(() => {});
}

export default function useOnlinePresence(currentUser) {
  const currentUserId = currentUser?.id;
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    let mounted = true;
    const syncOnlineUsers = (channel) => {
      if (mounted) {
        setOnlineUserIds(Array.from(new Set(flattenPresenceState(channel.presenceState()))));
      }
    };

    const channel = supabase.channel(ONLINE_CHANNEL);
    channel.on('presence', { event: 'sync' }, () => syncOnlineUsers(channel));
    channel.on('presence', { event: 'join' }, () => syncOnlineUsers(channel));
    channel.on('presence', { event: 'leave' }, () => syncOnlineUsers(channel));
    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') {
        return;
      }

      await updateLastSeen(currentUserId).catch(() => {});
      await channel
        .track({
          onlineAt: new Date().toISOString(),
          userId: currentUserId,
        })
        .catch(() => {});
    });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        safeUpdateLastSeen(currentUserId);
      }
    }, LAST_SEEN_INTERVAL_MS);

    const handleVisibilityChange = () => {
      safeUpdateLastSeen(currentUserId);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      safeUpdateLastSeen(currentUserId);
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return useMemo(() => new Set(currentUserId ? [...onlineUserIds, currentUserId] : []), [currentUserId, onlineUserIds]);
}

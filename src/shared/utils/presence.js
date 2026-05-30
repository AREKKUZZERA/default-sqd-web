const DEFAULT_STATUS = 'online';

export function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) {
    return 'offline';
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) {
    return 'был только что';
  }

  if (minutes < 60) {
    return `был ${minutes} мин назад`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `был ${hours} ч назад`;
  }

  const days = Math.floor(hours / 24);
  return `был ${days} д назад`;
}

export function applyPresenceStatus(profile, onlineUserIds) {
  if (!profile?.id) {
    return profile;
  }

  const isOnline = onlineUserIds.has(profile.id);

  return {
    ...profile,
    isOnline,
    status: profile.status || DEFAULT_STATUS,
    presenceLabel: isOnline ? (profile.status || DEFAULT_STATUS) : formatLastSeen(profile.lastSeenAt),
  };
}

const DEFAULT_STATUS = 'online';

export const USER_STATUS_OPTIONS = [
  { label: 'online', value: 'online' },
  { label: 'не активен', value: 'idle' },
  { label: 'не беспокоить', value: 'dnd' },
];

const STATUS_LABELS = USER_STATUS_OPTIONS.reduce((labels, option) => ({ ...labels, [option.value]: option.label }), {});
const STATUS_VALUES = new Set(USER_STATUS_OPTIONS.map((option) => option.value));

export function normalizePresenceStatus(status = DEFAULT_STATUS) {
  return STATUS_VALUES.has(status) ? status : DEFAULT_STATUS;
}

export function getPresenceLabel(status = DEFAULT_STATUS) {
  return STATUS_LABELS[normalizePresenceStatus(status)] || STATUS_LABELS[DEFAULT_STATUS];
}

export function getPresenceTone(profile) {
  if (!profile?.isOnline) {
    return 'offline';
  }

  return normalizePresenceStatus(profile.status);
}

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
  const status = normalizePresenceStatus(profile.status || DEFAULT_STATUS);

  return {
    ...profile,
    isOnline,
    status,
    presenceLabel: isOnline ? getPresenceLabel(status) : formatLastSeen(profile.lastSeenAt),
  };
}

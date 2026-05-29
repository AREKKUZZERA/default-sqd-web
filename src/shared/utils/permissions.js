const PERMISSION_ALIASES = {
  administrator: 'admin',
  admin: 'admin',
  creator: 'creator',
  mod: 'moderator',
  moderator: 'moderator',
  owner: 'owner',
};

const PERMISSION_ORDER = ['owner', 'creator', 'admin', 'moderator'];
const MODERATION_PERMISSIONS = new Set(['owner', 'creator', 'admin', 'moderator']);

export const PERMISSION_LABELS = {
  admin: 'ADMIN',
  creator: 'CREATOR',
  moderator: 'MODERATOR',
  owner: 'OWNER',
};

export function normalizePermissionValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return PERMISSION_ALIASES[normalized] || '';
}

export function getPermissions(profile = {}) {
  const rawPermissions = Array.isArray(profile.permissions)
    ? profile.permissions
    : String(profile.permissions || '')
        .split(/[,{|}\s]+/)
        .map((item) => item.replace(/"/g, ''));

  const values = [...rawPermissions, profile.role]
    .map(normalizePermissionValue)
    .filter(Boolean);
  const unique = new Set(values);

  return PERMISSION_ORDER.filter((permission) => unique.has(permission));
}

export function getDisplayRole(profile = {}) {
  const role = String(profile.role || '').trim();

  if (!role || normalizePermissionValue(role)) {
    return 'Member';
  }

  return role;
}

export function getPermissionLabel(permission) {
  return PERMISSION_LABELS[normalizePermissionValue(permission)] || String(permission || '').toUpperCase();
}

export function hasModerationPermission(profile = {}) {
  return getPermissions(profile).some((permission) => MODERATION_PERMISSIONS.has(permission));
}

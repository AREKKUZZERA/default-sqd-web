import { ShieldCheck } from 'lucide-react';
import { getPermissionLabel, getPermissions } from '../utils/permissions.js';

export default function PermissionBadges({ className = '', compact = false, permissions = [], profile = null }) {
  const normalizedPermissions = getPermissions(profile || { permissions });

  if (normalizedPermissions.length === 0) {
    return null;
  }

  return (
    <span className={['permission-badges inline-flex flex-wrap items-center gap-1', className].filter(Boolean).join(' ')}>
      {normalizedPermissions.map((permission) => (
        <span
          className={[
            'permission-badge inline-flex items-center gap-1 rounded-sqd-xs border font-mono font-extrabold uppercase tracking-[0.08em]',
            compact ? 'px-1.5 py-0.5 text-[0.52rem]' : 'px-2 py-1 text-[0.58rem]',
            `permission-badge--${permission}`,
          ].join(' ')}
          key={permission}
          title={`Право: ${getPermissionLabel(permission)}`}
        >
          <ShieldCheck aria-hidden="true" size={compact ? 10 : 12} strokeWidth={1.9} />
          {getPermissionLabel(permission)}
        </span>
      ))}
    </span>
  );
}

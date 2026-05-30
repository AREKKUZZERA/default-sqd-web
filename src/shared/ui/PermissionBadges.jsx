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
            'permission-badge inline-flex items-center rounded-sqd-xs border font-mono font-bold uppercase tracking-[0.08em]',
            compact ? 'gap-1.5 px-2 py-1 text-[0.56rem]' : 'gap-2 px-3 py-2 text-[0.64rem]',
            `permission-badge--${permission}`,
          ].join(' ')}
          key={permission}
          title={`Право: ${getPermissionLabel(permission)}`}
        >
          <ShieldCheck aria-hidden="true" size={compact ? 12 : 14} strokeWidth={1.8} />
          {getPermissionLabel(permission)}
        </span>
      ))}
    </span>
  );
}

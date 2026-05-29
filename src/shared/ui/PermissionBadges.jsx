import { ShieldCheck } from 'lucide-react';
import { getPermissionLabel, getPermissions } from '../utils/permissions.js';

export default function PermissionBadges({ className = '', permissions = [], profile = null }) {
  const normalizedPermissions = getPermissions(profile || { permissions });

  if (normalizedPermissions.length === 0) {
    return null;
  }

  return (
    <span className={['permission-badges inline-flex flex-wrap items-center gap-1', className].filter(Boolean).join(' ')}>
      {normalizedPermissions.map((permission) => (
        <span
          className={[
            'permission-badge inline-flex items-center gap-2 rounded-sqd-xs border px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em]',
            `permission-badge--${permission}`,
          ].join(' ')}
          key={permission}
          title={`Право: ${getPermissionLabel(permission)}`}
        >
          <ShieldCheck aria-hidden="true" size={14} strokeWidth={1.8} />
          {getPermissionLabel(permission)}
        </span>
      ))}
    </span>
  );
}
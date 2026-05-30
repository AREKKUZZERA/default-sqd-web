import { UserCircle } from 'lucide-react';

export default function RolePill({ className = '', role = 'Member' }) {
  return (
    <span
      className={[
        'role-pill inline-flex items-center gap-2 rounded-sqd-xs border px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em]',
        className,
      ].filter(Boolean).join(' ')}
      title={`Роль: ${role || 'Member'}`}
    >
      <UserCircle aria-hidden="true" size={14} strokeWidth={1.8} />
      роль: {role || 'Member'}
    </span>
  );
}

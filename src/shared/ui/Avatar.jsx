import { normalizePresenceStatus } from '../utils/presence.js';

export default function Avatar({ label, image, size = 'md', active = false, status = 'online' }) {
  const sizes = {
    sm: 'h-9 w-9 text-[0.65rem]',
    md: 'h-11 w-11 text-xs',
    lg: 'h-16 w-16 text-base',
  };
  const statusSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={[
        'poster-avatar relative grid shrink-0 place-items-center rounded-sqd-sm border border-border bg-surface-3 font-mono font-extrabold text-text',
        sizes[size],
      ].join(' ')}
      aria-hidden="true"
    >
      {image ? <img alt="" className="h-full w-full rounded-sqd-sm object-cover" src={image} /> : label}
      <span
        className={[
          'avatar-status-dot absolute bottom-0 right-0 z-10 rounded-full',
          statusSizes[size],
          active ? `avatar-status-dot--${normalizePresenceStatus(status)}` : 'avatar-status-dot--offline',
        ].join(' ')}
      />
    </span>
  );
}

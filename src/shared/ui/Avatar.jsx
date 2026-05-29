export default function Avatar({ label, image, size = 'md', active = false }) {
  const sizes = {
    sm: 'h-9 w-9 text-[0.65rem]',
    md: 'h-11 w-11 text-xs',
    lg: 'h-16 w-16 text-base',
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
      {active ? (
        <span className="avatar-status-dot absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-bg bg-positive" />
      ) : null}
    </span>
  );
}

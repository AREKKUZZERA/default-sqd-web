export default function IconButton({ icon: Icon, label, active = false, children, disabled = false, ...props }) {
  return (
    <button
      type="button"
      className={[
        'poster-button inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-sqd-xs border px-3 font-ui text-xs font-bold transition',
        active
          ? 'border-border-strong bg-accent-soft text-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]'
          : 'border-border bg-surface-2/70 text-text-soft hover:border-border-strong hover:bg-surface-3/80 hover:text-text',
        disabled ? 'cursor-not-allowed opacity-50 hover:border-border hover:bg-surface-2/70 hover:text-text-soft' : '',
      ].join(' ')}
      aria-label={label}
      disabled={disabled}
      title={label}
      {...props}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
      {children ? <span>{children}</span> : null}
    </button>
  );
}

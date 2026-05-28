export default function Panel({ children, className = '', as: Component = 'section', ...props }) {
  return (
    <Component
      className={[
        'poster-panel rounded-sqd-md border border-border bg-surface/88 shadow-[var(--shadow-panel)] backdrop-blur-md',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </Component>
  );
}

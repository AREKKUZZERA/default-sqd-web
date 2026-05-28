export default function SectionTitle({ label, title, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {label ? <p className="mb-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-accent">{label}</p> : null}
        <h2 className="font-ui text-xl font-bold leading-tight text-text">{title}</h2>
      </div>
      {action}
    </div>
  );
}

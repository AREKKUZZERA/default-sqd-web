import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  busy = false,
  cancelLabel = 'Отмена',
  confirmLabel = 'Удалить',
  description,
  onCancel,
  onConfirm,
  open = false,
  title = 'Подтвердите действие',
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="confirm-dialog fixed inset-0 z-[90] grid place-items-center bg-black/55 px-4 backdrop-blur-sm" role="presentation">
      <section
        aria-describedby="confirm-dialog-description"
        aria-modal="true"
        className="w-full max-w-sm rounded-sqd-md border border-border-strong bg-bg-soft p-4 shadow-[var(--shadow-panel)]"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sqd-sm border border-danger/40 bg-danger-soft text-danger">
            <AlertTriangle aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="font-ui text-base font-bold text-text">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-5 text-text-soft" id="confirm-dialog-description">{description}</p> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            className="min-h-10 rounded-sqd-xs border border-border bg-surface-2/70 px-3 font-ui text-sm font-bold text-text-soft transition hover:border-border-strong hover:text-text disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="danger-icon-button min-h-10 rounded-sqd-xs border px-3 font-ui text-sm font-bold transition disabled:cursor-wait disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? 'выполняем...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

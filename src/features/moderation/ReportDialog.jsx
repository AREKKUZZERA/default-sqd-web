import { Flag } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { MAX_REPORT_REASON_LENGTH } from '../../shared/constants/content.js';

export default function ReportDialog({ busy = false, error = '', onCancel, onSubmit, open = false, targetLabel = '' }) {
  const [reason, setReason] = useState('');
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        onCancel?.();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.(reason.trim() || 'Нарушение правил');
    setReason('');
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-[90] grid place-items-center bg-black/55 px-4 backdrop-blur-sm" role="presentation">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="app-modal-panel w-full max-w-md rounded-sqd-md border border-border-strong bg-bg-soft p-4 shadow-[var(--shadow-panel)]"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sqd-sm border border-danger/40 bg-danger-soft text-danger">
            <Flag aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="font-ui text-base font-bold text-text" id={titleId}>Пожаловаться</h2>
            <p className="mt-1 text-sm leading-5 text-text-soft" id={descriptionId}>
              {targetLabel ? `Объект: ${targetLabel}. ` : ''}Жалоба попадёт в очередь модерации.
            </p>
          </div>
        </div>

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm text-text-soft">
            Причина
            <textarea
              className="min-h-24 resize-y rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-5 text-text outline-none focus:border-border-strong"
              disabled={busy}
              maxLength={MAX_REPORT_REASON_LENGTH}
              name="report-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder={`Опишите нарушение: спам, оскорбление, мошенничество, личные данные и т.п. Макс. ${MAX_REPORT_REASON_LENGTH} символов.`}
              value={reason}
            />
          </label>
          {error ? <p className="rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="min-h-10 rounded-sqd-xs border border-border bg-surface-2/70 px-3 font-ui text-sm font-bold text-text-soft transition hover:border-border-strong hover:text-text disabled:opacity-50"
              disabled={busy}
              onClick={onCancel}
              type="button"
            >
              Отмена
            </button>
            <button
              className="danger-icon-button min-h-10 rounded-sqd-xs border px-3 font-ui text-sm font-bold transition disabled:cursor-wait disabled:opacity-50"
              disabled={busy}
              type="submit"
            >
              {busy ? 'отправляем...' : 'отправить жалобу'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

import { ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyModerationAction, fetchModerationReports, updateReportStatus } from '../../shared/api/moderationApi.js';
import Panel from '../../shared/ui/Panel.jsx';

const ACTIONS = [
  { label: 'Предупреждение', value: 'warning' },
  { label: 'Мут', value: 'mute' },
  { label: 'Бан', value: 'ban' },
  { label: 'Снять мут', value: 'unmute' },
  { label: 'Снять бан', value: 'unban' },
  { label: 'Заметка', value: 'note' },
];

const DURATIONS = [
  { label: '24 часа', hours: 24 },
  { label: '7 дней', hours: 24 * 7 },
  { label: '30 дней', hours: 24 * 30 },
  { label: 'Навсегда', hours: 0 },
];

const reportTargetLabel = (report) => {
  if (report.postId) return `пост #${report.postId}`;
  if (report.commentId) return `комментарий #${report.commentId}`;
  if (report.messageId) return `сообщение #${report.messageId}`;
  return report.targetName ? `пользователь ${report.targetName}` : 'пользователь';
};

const getExpiresAt = (action, hours) => {
  if (!['mute', 'ban'].includes(action) || !hours) return null;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
};

export default function ModerationPanel({ currentUser, people = [], onOpenProfile }) {
  const [reports, setReports] = useState([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [action, setAction] = useState('warning');
  const [durationHours, setDurationHours] = useState(24);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const targets = useMemo(() => people.filter((person) => person.id !== currentUser?.id), [currentUser?.id, people]);

  const loadReports = useCallback(async () => {
    try {
      setError('');
      setReports(await fetchModerationReports());
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadReports);
  }, [loadReports]);

  const selectedTargetUserId = targetUserId || targets[0]?.id || '';

  const applyAction = async (event) => {
    event.preventDefault();

    if (!selectedTargetUserId || busy) return;

    try {
      setBusy(true);
      setError('');
      setNotice('');
      await applyModerationAction({
        action,
        expiresAt: getExpiresAt(action, Number(durationHours)),
        reason: reason.trim(),
        targetUserId: selectedTargetUserId,
      });
      setNotice('Действие применено. Серверная защита начнёт учитывать его сразу.');
      setReason('');
      await loadReports();
    } catch (applyError) {
      setError(applyError.message);
    } finally {
      setBusy(false);
    }
  };

  const changeReportStatus = async (reportId, status) => {
    try {
      setBusy(true);
      setError('');
      await updateReportStatus(reportId, status);
      await loadReports();
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="poster-title font-display text-4xl leading-none text-text sm:text-5xl">Модерация</h1>
          <p className="mt-2 text-sm text-text-soft">Жалобы, муты, баны и ручные действия поверх Supabase RPC-защиты.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-sqd-sm border border-border bg-surface/80 px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-text-soft">
          <ShieldAlert size={15} strokeWidth={1.8} /> {reports.length} жалоб
        </span>
      </div>

      {error ? <p className="mb-4 rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-sqd-xs border border-positive/35 bg-positive-soft/20 px-3 py-2 text-sm text-positive">{notice}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-ui text-lg font-bold text-text">Очередь жалоб</h2>
            <button className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text-soft transition hover:border-border-strong hover:text-text" onClick={loadReports} type="button">
              обновить
            </button>
          </div>
          <div className="grid gap-2">
            {reports.length > 0 ? reports.map((report) => (
              <article className="rounded-sqd-sm border border-border bg-bg-soft/75 p-3" key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-ui text-sm font-bold text-text">{reportTargetLabel(report)}</p>
                    <p className="mt-1 text-sm text-text-soft">{report.reason || 'Причина не указана'}</p>
                    <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">
                      от {report.reporterName || report.reporterId} / {new Date(report.createdAt).toLocaleString('ru-RU')} / {report.status}
                    </p>
                  </div>
                  {report.targetId ? (
                    <button className="rounded-sqd-xs border border-border bg-surface-2/70 px-2 py-1 text-xs text-text-soft hover:border-border-strong hover:text-text" onClick={() => onOpenProfile?.(report.targetId)} type="button">
                      профиль
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['reviewing', 'resolved', 'rejected'].map((status) => (
                    <button
                      className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:text-text disabled:opacity-50"
                      disabled={busy || report.status === status}
                      key={status}
                      onClick={() => changeReportStatus(report.id, status)}
                      type="button"
                    >
                      {status}
                    </button>
                  ))}
                  {report.targetId ? (
                    <button className="rounded-sqd-xs border border-warning/45 bg-warning/10 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-warning" onClick={() => setTargetUserId(report.targetId)} type="button">
                      выбрать нарушителя
                    </button>
                  ) : null}
                </div>
              </article>
            )) : (
              <p className="rounded-sqd-xs border border-border bg-surface-2/70 p-4 text-sm text-text-soft">Открытых жалоб пока нет.</p>
            )}
          </div>
        </Panel>

        <Panel className="p-3 sm:p-4">
          <h2 className="font-ui text-lg font-bold text-text">Действие модератора</h2>
          <form className="mt-3 grid gap-3" onSubmit={applyAction}>
            <label className="grid gap-1 text-sm text-text-soft">
              Пользователь
              <select className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text outline-none focus:border-border-strong" onChange={(event) => setTargetUserId(event.target.value)} value={selectedTargetUserId}>
                {targets.map((person) => <option key={person.id} value={person.id}>{person.name} / @{person.userId}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-text-soft">
              Действие
              <select className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text outline-none focus:border-border-strong" onChange={(event) => setAction(event.target.value)} value={action}>
                {ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            {['mute', 'ban'].includes(action) ? (
              <label className="grid gap-1 text-sm text-text-soft">
                Срок
                <select className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text outline-none focus:border-border-strong" onChange={(event) => setDurationHours(event.target.value)} value={durationHours}>
                  {DURATIONS.map((item) => <option key={item.label} value={item.hours}>{item.label}</option>)}
                </select>
              </label>
            ) : null}
            <label className="grid gap-1 text-sm text-text-soft">
              Причина
              <textarea className="min-h-24 resize-none rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-5 text-text outline-none focus:border-border-strong" maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Что произошло" value={reason} />
            </label>
            <button className="min-h-10 rounded-sqd-xs border border-border-strong bg-accent-soft px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text disabled:opacity-50" disabled={!selectedTargetUserId || busy} type="submit">
              {busy ? 'применяем...' : 'применить'}
            </button>
          </form>
        </Panel>
      </div>
    </section>
  );
}

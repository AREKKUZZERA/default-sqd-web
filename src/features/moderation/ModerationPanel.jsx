import { CheckCircle2, Clock3, FileText, Flag, ShieldAlert, UserRound, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MAX_REPORT_REASON_LENGTH } from '../../shared/constants/content.js';
import { applyModerationAction, fetchModerationReports, updateReportStatus } from '../../shared/api/moderationApi.js';
import Panel from '../../shared/ui/Panel.jsx';
import PermissionBadges from '../../shared/ui/PermissionBadges.jsx';

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

const STATUS_OPTIONS = [
  { icon: Flag, label: 'Новая', value: 'open' },
  { icon: Clock3, label: 'В работе', value: 'reviewing' },
  { icon: CheckCircle2, label: 'Решено', value: 'resolved' },
  { icon: XCircle, label: 'Отклонено', value: 'rejected' },
];

const ACTIVE_REPORT_STATUSES = new Set(['open', 'reviewing']);
const RESOLVED_REPORT_STATUSES = new Set(['resolved', 'rejected']);

const contentTypeLabels = {
  comment: 'Комментарий',
  message: 'Сообщение',
  post: 'Пост',
  user: 'Пользователь',
};

const reportTargetLabel = (report) => {
  if (report.contentType) return contentTypeLabels[report.contentType] || 'Объект';
  if (report.postId) return 'Пост';
  if (report.commentId) return 'Комментарий';
  if (report.messageId) return 'Сообщение';
  return 'Пользователь';
};

const reportContentId = (report) => report.postId || report.commentId || report.messageId || report.targetId || report.id;

const shortId = (value = '') => String(value || '').slice(0, 8) || 'unknown';

const formatDate = (value) => {
  if (!value) return 'нет даты';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'нет даты';

  return date.toLocaleString('ru-RU');
};

const getStatusOption = (status) => STATUS_OPTIONS.find((item) => item.value === status) || STATUS_OPTIONS[0];

const getExpiresAt = (action, hours) => {
  if (!['mute', 'ban'].includes(action) || !hours) return null;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
};

function StatusPill({ status }) {
  const statusOption = getStatusOption(status);
  const StatusIcon = statusOption.icon;

  return (
    <span className={["inline-flex items-center gap-1.5 rounded-sqd-xs border px-2 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em]", `report-status report-status--${statusOption.value}`].join(' ')}>
      <StatusIcon aria-hidden="true" size={12} strokeWidth={1.9} />
      {statusOption.label}
    </span>
  );
}

function ReportToastStack({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div className="report-toast-stack fixed right-3 top-3 z-[120] grid w-[min(24rem,calc(100vw-1.5rem))] gap-2 sm:right-5 sm:top-5" role="status">
      {toasts.map((toast) => (
        <div className="report-toast rounded-sqd-sm border border-border-strong bg-bg-soft/95 p-3 shadow-[var(--shadow-panel)] backdrop-blur-md" key={toast.id}>
          <p className="font-ui text-sm font-bold text-text">{toast.title}</p>
          <p className="mt-1 text-sm text-text-soft">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

function ReportCard({ busy, onOpenProfile, onSelectTarget, onStatusChange, report }) {
  const contentLabel = reportTargetLabel(report);
  const contentId = reportContentId(report);
  const hasContentText = Boolean(report.contentText?.trim());

  return (
    <article className="rounded-sqd-sm border border-border bg-bg-soft/75 p-3.5 transition hover:border-border-strong hover:bg-surface-2/70">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-ui text-base font-bold text-text">Репорт #{shortId(report.id)}</p>
            <StatusPill status={report.status} />
          </div>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">
            создан {formatDate(report.createdAt)} / объект {contentLabel.toLowerCase()} #{contentId}
          </p>
        </div>

        <label className="grid min-w-[11rem] gap-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">
          Статус
          <select
            className="rounded-sqd-xs border border-border bg-surface-2/80 px-3 py-2 font-ui text-sm normal-case tracking-normal text-text outline-none transition focus:border-border-strong disabled:opacity-55"
            disabled={busy}
            onChange={(event) => onStatusChange(report, event.target.value)}
            value={report.status}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-sqd-xs border border-border bg-surface-2/55 p-3">
          <p className="mb-2 inline-flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted">
            <UserRound size={13} strokeWidth={1.8} /> Кто отправил
          </p>
          <p className="font-ui text-sm font-bold text-text">{report.reporterName || report.reporterId || 'Неизвестный пользователь'}</p>
          <p className="mt-0.5 font-mono text-[0.62rem] text-muted">@{report.reporterUserId || report.reporterId || 'unknown'}</p>
        </div>

        <div className="rounded-sqd-xs border border-border bg-surface-2/55 p-3">
          <p className="mb-2 inline-flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted">
            <ShieldAlert size={13} strokeWidth={1.8} /> На кого жалоба
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0">
              <p className="font-ui text-sm font-bold text-text">{report.targetName || report.contentAuthorName || report.targetId || 'Неизвестный пользователь'}</p>
              <p className="mt-0.5 font-mono text-[0.62rem] text-muted">@{report.targetUserId || report.contentAuthorUserId || report.targetId || 'unknown'}</p>
            </div>
            <PermissionBadges compact permissions={report.targetPermissions} />
            {report.targetRole ? <span className="role-pill rounded-sqd-xs border px-2 py-1 font-mono text-[0.56rem] uppercase tracking-[0.08em]">роль: {report.targetRole}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.targetId ? (
              <button className="rounded-sqd-xs border border-border bg-bg-soft/75 px-2.5 py-1.5 text-xs font-bold text-text-soft transition hover:border-border-strong hover:text-text" onClick={() => onOpenProfile?.(report.targetId)} type="button">
                открыть профиль
              </button>
            ) : null}
            {report.targetId ? (
              <button className="primary-action-button rounded-sqd-xs border px-2.5 py-1.5 text-xs font-bold transition" onClick={() => onSelectTarget(report.targetId)} type="button">
                выбрать нарушителя
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="rounded-sqd-xs border border-border bg-surface-2/55 p-3">
          <p className="mb-2 inline-flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted">
            <FileText size={13} strokeWidth={1.8} /> Содержимое жалобы
          </p>
          {hasContentText ? (
            <p className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm leading-6 text-text-soft">
              {report.contentText}
            </p>
          ) : (
            <p className="rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm text-muted">Текст недоступен или жалоба была отправлена на пользователя.</p>
          )}
        </div>

        <div className="rounded-sqd-xs border border-border bg-surface-2/55 p-3">
          <p className="mb-2 inline-flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted">
            <Flag size={13} strokeWidth={1.8} /> Причина
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-text">{report.reason || 'Причина не указана.'}</p>
        </div>
      </div>
    </article>
  );
}

function ReportsSection({ busy, emptyText, onOpenProfile, onSelectTarget, onStatusChange, reports, title }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-ui text-base font-bold text-text">{title}</h3>
        <span className="rounded-sqd-xs border border-border bg-surface-2/70 px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted">{reports.length}</span>
      </div>
      {reports.length > 0 ? (
        <div className="grid gap-3">
          {reports.map((report) => (
            <ReportCard
              busy={busy}
              key={report.id}
              onOpenProfile={onOpenProfile}
              onSelectTarget={onSelectTarget}
              onStatusChange={onStatusChange}
              report={report}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-sqd-xs border border-border bg-surface-2/70 p-4 text-sm text-text-soft">{emptyText}</p>
      )}
    </div>
  );
}

export default function ModerationPanel({ currentUser, initialTargetUserId = '', onInitialTargetHandled, people = [], onOpenProfile }) {
  const [reports, setReports] = useState([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [action, setAction] = useState('warning');
  const [durationHours, setDurationHours] = useState(24);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [toasts, setToasts] = useState([]);

  const targets = useMemo(() => people.filter((person) => person.id !== currentUser?.id), [currentUser?.id, people]);

  const activeReports = useMemo(() => reports.filter((report) => ACTIVE_REPORT_STATUSES.has(report.status)), [reports]);
  const resolvedReports = useMemo(() => reports.filter((report) => RESOLVED_REPORT_STATUSES.has(report.status)), [reports]);

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

  useEffect(() => {
    if (!initialTargetUserId) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setTargetUserId(initialTargetUserId);
      onInitialTargetHandled?.();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [initialTargetUserId, onInitialTargetHandled]);

  const selectedTargetUserId = targetUserId || targets[0]?.id || '';

  const pushReportToast = useCallback((report, status) => {
    const statusLabel = getStatusOption(status).label;
    const toastId = `${report.id}-${status}-${Date.now()}`;

    setToasts((items) => [
      ...items,
      {
        id: toastId,
        message: `Статус: ${statusLabel}. ${RESOLVED_REPORT_STATUSES.has(status) ? 'Жалоба перенесена в «Решенные проблемы».' : 'Жалоба осталась в активной очереди.'}`,
        title: `Репорт #${shortId(report.id)}`,
      },
    ]);

    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== toastId));
    }, 4200);
  }, []);

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

  const changeReportStatus = async (report, status) => {
    if (!report?.id || report.status === status || busy) {
      return;
    }

    try {
      setBusy(true);
      setError('');
      await updateReportStatus(report.id, status);
      pushReportToast(report, status);
      await loadReports();
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0">
      <ReportToastStack toasts={toasts} />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="poster-title font-display text-4xl leading-none text-text sm:text-5xl">Модерация</h1>
          <p className="mt-2 text-sm text-text-soft">Жалобы, статусы, муты, баны и ручные действия поверх Supabase RPC-защиты.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-sqd-sm border border-border bg-surface/80 px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-text-soft">
            <ShieldAlert size={15} strokeWidth={1.8} /> {activeReports.length} активных
          </span>
          <span className="inline-flex items-center gap-2 rounded-sqd-sm border border-border bg-surface/80 px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-text-soft">
            <CheckCircle2 size={15} strokeWidth={1.8} /> {resolvedReports.length} решенных
          </span>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-sqd-xs border border-positive/35 bg-positive-soft/20 px-3 py-2 text-sm text-positive">{notice}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-3 sm:p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-ui text-lg font-bold text-text">Очередь жалоб</h2>
              <p className="mt-1 text-sm text-muted">Открытые и взятые в работу репорты. Решенные и отклоненные уходят ниже.</p>
            </div>
            <button className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text-soft transition hover:border-border-strong hover:text-text" onClick={loadReports} type="button">
              обновить
            </button>
          </div>

          <div className="grid gap-5">
            <ReportsSection
              busy={busy}
              emptyText="Открытых жалоб пока нет."
              onOpenProfile={onOpenProfile}
              onSelectTarget={setTargetUserId}
              onStatusChange={changeReportStatus}
              reports={activeReports}
              title="Активные репорты"
            />
            <ReportsSection
              busy={busy}
              emptyText="Решенных проблем пока нет."
              onOpenProfile={onOpenProfile}
              onSelectTarget={setTargetUserId}
              onStatusChange={changeReportStatus}
              reports={resolvedReports}
              title="Решенные проблемы"
            />
          </div>
        </Panel>

        <Panel className="p-3 sm:p-4">
          <h2 className="font-ui text-lg font-bold text-text">Действие модератора</h2>
          <p className="mt-1 text-sm text-muted">Сначала выберите нарушителя в карточке жалобы или вручную ниже.</p>
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
              <textarea
                className="min-h-24 resize-none rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-5 text-text outline-none focus:border-border-strong"
                maxLength={MAX_REPORT_REASON_LENGTH}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Что произошло и почему нужно действие"
                value={reason}
              />
            </label>
            <button className="primary-action-button min-h-10 rounded-sqd-xs border px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] disabled:opacity-50" disabled={!selectedTargetUserId || busy} type="submit">
              {busy ? 'применяем...' : 'применить'}
            </button>
          </form>
        </Panel>
      </div>
    </section>
  );
}

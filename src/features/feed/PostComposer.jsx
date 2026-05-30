import { Eye, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { MAX_POST_LENGTH } from '../../shared/constants/content.js';
import useAutosizeTextarea from '../../shared/hooks/useAutosizeTextarea.js';
import { extractHashtags } from '../../shared/utils/hashtags.js';
import Avatar from '../../shared/ui/Avatar.jsx';
import MarkdownBody from '../../shared/ui/MarkdownBody.jsx';

const DRAFT_STORAGE_KEY = 'sqd:post-composer:draft';

const getDraftStorageKey = (userId) => `${DRAFT_STORAGE_KEY}:${userId || 'guest'}`;

const readStoredDraft = (storageKey) => {
  try {
    return window.localStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
};

const writeStoredDraft = (storageKey, value) => {
  try {
    if (value) {
      window.localStorage.setItem(storageKey, value);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Draft persistence is optional; posting must keep working if storage is unavailable.
  }
};

export default function PostComposer({ currentUser, onPost }) {
  const draftStorageKey = getDraftStorageKey(currentUser?.id);
  const textareaRef = useRef(null);
  const [draft, setDraft] = useState(() => readStoredDraft(draftStorageKey));
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const remaining = MAX_POST_LENGTH - draft.length;
  const hashtags = extractHashtags(draft);
  const canSubmit = Boolean(draft.trim()) && !sending;

  useAutosizeTextarea(textareaRef, draft, { maxHeight: 560 });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text || sending) {
      return;
    }

    try {
      setSending(true);
      setError('');
      await onPost({ hashtags, text });
      setDraft('');
      setPreviewOpen(false);
      writeStoredDraft(draftStorageKey, '');
    } catch (postError) {
      setError(postError.message);
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (event) => {
    const nextDraft = event.target.value;

    setDraft(nextDraft);
    writeStoredDraft(draftStorageKey, nextDraft);
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form className="post-composer rounded-sqd-md border border-border bg-surface/90 p-4 shadow-[var(--shadow-panel)] backdrop-blur-md" onSubmit={handleSubmit}>
      <div className="post-composer-layout flex gap-3">
        <Avatar active image={currentUser.avatarImage} label={currentUser.avatar} />
        <div className="relative min-w-0 flex-1">
          <textarea
            className="autosize-textarea min-h-24 w-full resize-y rounded-sqd-sm border border-border bg-bg-soft/75 p-3 text-sm leading-6 text-text outline-none transition placeholder:text-muted focus:border-border-strong"
            maxLength={MAX_POST_LENGTH}
            name="post-body"
            onChange={handleDraftChange}
            onKeyDown={handleComposerKeyDown}
            placeholder="Напишите новый пост"
            ref={textareaRef}
            value={draft}
          />
          {hashtags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hashtags.map((tag) => (
                <span className="rounded-sqd-xs border border-border bg-accent-soft px-1.5 py-0.5 font-mono text-[0.56rem] font-extrabold uppercase tracking-[0.08em] text-text" key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          {previewOpen && draft.trim() ? (
            <div className="post-preview mt-3 rounded-sqd-sm border border-border bg-bg-soft/75 p-3" aria-live="polite">
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2">
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted">Предпросмотр</p>
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted">как в ленте</span>
              </div>
              <MarkdownBody className="text-sm leading-6 text-text-soft" value={draft.trim()} />
            </div>
          ) : null}

          <div className="post-composer-footer mt-3 flex flex-wrap items-end justify-between gap-3 pr-24">
            <p className="post-composer-hint text-xs text-muted">Enter — новая строка, Ctrl/⌘+Enter — публикация. Markdown, списки и хештеги поддерживаются.</p>
            <span className={['font-mono text-[0.65rem]', remaining < 300 ? 'text-warning' : 'text-muted'].join(' ')}>
              {remaining}
            </span>
          </div>
          <div className="post-composer-actions absolute bottom-0 right-0 flex items-center gap-2" aria-label="Действия поста">
            <button
              aria-label={previewOpen ? 'Скрыть предпросмотр' : 'Показать предпросмотр'}
              className="sqd-icon-action sqd-icon-action--preview grid size-10 place-items-center rounded-sqd-xs border transition disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!draft.trim()}
              onClick={() => setPreviewOpen((isOpen) => !isOpen)}
              title={previewOpen ? 'Скрыть предпросмотр' : 'Предпросмотр'}
              type="button"
            >
              <Eye size={16} strokeWidth={1.9} />
            </button>
            <button
              aria-label={sending ? 'Публикуем пост' : 'Опубликовать пост'}
              className="sqd-icon-action sqd-icon-action--publish grid size-10 place-items-center rounded-sqd-xs border transition disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit}
              title={sending ? 'Публикуем' : 'Опубликовать'}
              type="submit"
            >
              <Send size={16} strokeWidth={1.9} />
            </button>
          </div>
          {error ? <p className="mt-3 rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p> : null}
        </div>
      </div>
    </form>
  );
}

import { Send } from 'lucide-react';
import { useState } from 'react';
import { extractHashtags } from '../../shared/utils/hashtags.js';
import Avatar from '../../shared/ui/Avatar.jsx';

export default function PostComposer({ currentUser, onPost }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const remaining = 280 - draft.length;
  const hashtags = extractHashtags(draft);

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
    } catch (postError) {
      setError(postError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="rounded-sqd-md border border-border bg-surface/90 p-4 shadow-[var(--shadow-panel)] backdrop-blur-md" onSubmit={handleSubmit}>
      <div className="flex gap-3">
        <Avatar active image={currentUser.avatarImage} label={currentUser.avatar} />
        <div className="min-w-0 flex-1">
          <textarea
            className="min-h-24 w-full resize-none rounded-sqd-sm border border-border bg-bg-soft/75 p-3 text-sm leading-6 text-text outline-none transition placeholder:text-muted focus:border-border-strong"
            maxLength={280}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Напишите новый пост"
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Хештеги можно добавить прямо в текст: #shluxabot</p>
            <div className="flex items-center gap-3">
              <span className={['font-mono text-[0.65rem]', remaining < 30 ? 'text-warning' : 'text-muted'].join(' ')}>
                {remaining}
              </span>
              <button
                className="sqd-button inline-flex h-10 items-center gap-2 rounded-sqd-xs border border-border-strong bg-accent-soft px-4 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)] transition disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-3 disabled:text-muted disabled:shadow-none"
                disabled={!draft.trim() || sending}
                type="submit"
              >
                <Send size={15} strokeWidth={1.8} />
                {sending ? 'публикуем' : 'опубликовать'}
              </button>
            </div>
          </div>
          {error ? <p className="mt-3 rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{error}</p> : null}
        </div>
      </div>
    </form>
  );
}

import { Hash, Image, Send } from 'lucide-react';
import { useState } from 'react';
import { collectHashtags } from '../../shared/utils/hashtags.js';
import Avatar from '../../shared/ui/Avatar.jsx';
import IconButton from '../../shared/ui/IconButton.jsx';

export default function PostComposer({ currentUser, onPost }) {
  const [draft, setDraft] = useState('');
  const [hashtagDraft, setHashtagDraft] = useState('');
  const [mediaAttached, setMediaAttached] = useState(false);
  const remaining = 280 - draft.length;
  const hashtags = collectHashtags({ input: hashtagDraft, text: draft });

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text || hashtags.length === 0) {
      return;
    }

    onPost({ hashtags, mediaAttached, text });
    setDraft('');
    setHashtagDraft('');
    setMediaAttached(false);
  };

  return (
    <form className="rounded-sqd-md border border-border-strong bg-surface/90 p-4 shadow-[var(--shadow-panel)] backdrop-blur-md" onSubmit={handleSubmit}>
      <div className="flex gap-3">
        <Avatar active image={currentUser.avatarImage} label={currentUser.avatar} />
        <div className="min-w-0 flex-1">
          <textarea
            className="min-h-24 w-full resize-none rounded-sqd-sm border border-border bg-bg-soft/75 p-3 text-sm leading-6 text-text outline-none transition placeholder:text-muted focus:border-border-strong"
            maxLength={280}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Напишите пост для команды с #хештегом"
            value={draft}
          />
          <label className="mt-2 flex items-center gap-2 rounded-sqd-sm border border-border bg-bg-soft/75 px-3 py-2 text-text-soft transition-within focus-within:border-border-strong">
            <Hash size={15} strokeWidth={1.8} />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              onChange={(event) => setHashtagDraft(event.target.value)}
              placeholder="Отдельные хештеги: design, #team"
              value={hashtagDraft}
            />
          </label>
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
            <div className="flex flex-wrap gap-2">
              <IconButton active={mediaAttached} icon={Image} label="Медиа" onClick={() => setMediaAttached((value) => !value)}>
                {mediaAttached ? 'медиа' : null}
              </IconButton>
            </div>
            <div className="flex items-center gap-3">
              <span className={['font-mono text-[0.65rem]', remaining < 30 ? 'text-warning' : 'text-muted'].join(' ')}>
                {remaining}
              </span>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-sqd-xs border border-border-strong bg-accent-soft px-4 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)] transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-3 disabled:text-muted disabled:shadow-none"
                disabled={!draft.trim() || hashtags.length === 0}
                type="submit"
              >
                <Send size={15} strokeWidth={1.8} />
                опубликовать
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

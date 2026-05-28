import { Bookmark, Heart, MessageCircle, Repeat2, Send, Share2 } from 'lucide-react';
import { useState } from 'react';
import Avatar from '../../shared/ui/Avatar.jsx';
import IconButton from '../../shared/ui/IconButton.jsx';
import Panel from '../../shared/ui/Panel.jsx';

export default function PostCard({ compact = false, post, onComment, onToggle }) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [shared, setShared] = useState(false);
  const replyCount = post.replies + post.comments.length;
  const commentsId = `post-comments-${post.id}`;
  const tags = post.tags?.length ? post.tags : [post.tag].filter(Boolean);

  const handleCommentSubmit = (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text) {
      return;
    }

    onComment(post.id, text);
    setDraft('');
    setCommentOpen(false);
  };

  const handleShare = async () => {
    const shareText = `${post.author}: ${post.text}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'default squad', text: shareText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }

      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShared(false);
    }
  };

  return (
    <Panel as="article" className={[compact ? 'p-3' : 'p-3.5 sm:p-4', 'transition hover:border-border-strong hover:bg-surface/95'].join(' ')}>
      <div className="flex gap-2.5 sm:gap-3">
        <Avatar image={post.avatarImage} label={post.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-ui text-[0.95rem] font-bold leading-5 text-text">{post.author}</h3>
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
              @{post.userId} / {post.time}
            </span>
            {tags.map((tag) => (
              <span className="rounded-sqd-xs border border-border bg-accent-soft px-1.5 py-0.5 font-mono text-[0.56rem] font-extrabold uppercase tracking-[0.08em] text-text" key={tag}>
                #{tag}
              </span>
            ))}
          </div>

          <p className={[compact ? 'mt-1.5 leading-5' : 'mt-2 leading-6', 'max-w-3xl text-[0.92rem] text-text-soft'].join(' ')}>
            {post.text}
          </p>

          {post.mediaAttached ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-sqd-xs border border-positive/45 bg-positive-soft px-1.5 py-0.5 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-positive">
                медиа
              </span>
            </div>
          ) : null}

          {post.mediaAttached ? (
            <div className="mt-2.5 rounded-sqd-sm border border-border bg-[linear-gradient(135deg,rgba(183,100,124,0.09),rgba(123,191,180,0.055))] p-3">
              <p className="font-ui text-sm font-bold text-text">Медиа прикреплено</p>
              <p className="mt-1 text-sm text-text-soft">Файл будет опубликован вместе с постом.</p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
            <IconButton active={post.liked} icon={Heart} label="Лайк" onClick={() => onToggle(post.id, 'liked')}>
              {post.likes}
            </IconButton>
            <IconButton
              active={commentOpen}
              aria-controls={commentsId}
              aria-expanded={commentOpen}
              icon={MessageCircle}
              label="Комментировать"
              onClick={() => setCommentOpen((isOpen) => !isOpen)}
            >
              {replyCount}
            </IconButton>
            <IconButton active={post.reposted} icon={Repeat2} label="Репост" onClick={() => onToggle(post.id, 'reposted')}>
              {post.reposts}
            </IconButton>
            <IconButton active={post.bookmarked} icon={Bookmark} label="В избранное" onClick={() => onToggle(post.id, 'bookmarked')} />
            <IconButton active={shared} icon={Share2} label="Поделиться" onClick={handleShare} />
          </div>

          {shared ? (
            <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-positive">
              ссылка скопирована
            </p>
          ) : null}
        </div>
      </div>

      <div
        aria-hidden={!commentOpen}
        className={['post-comments', commentOpen ? 'post-comments--open' : ''].join(' ')}
        id={commentsId}
      >
        <div className="post-comments__inner mt-3 border-t border-border pt-3">
          {post.comments.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">Комментарии</p>
                <span className="font-mono text-[0.6rem] text-muted">{replyCount}</span>
              </div>

              <div className="grid gap-1.5">
                {post.comments.slice(0, 2).map((comment) => (
                  <div className="flex gap-2 rounded-sqd-sm border border-border bg-bg-soft/80 p-2.5" key={comment.id}>
                    <Avatar image={comment.avatarImage} label={comment.avatar} size="sm" />
                    <div className="min-w-0">
                      <p className="font-ui text-[0.82rem] font-bold leading-4 text-text">{comment.author}</p>
                      <p className="mt-1 text-[0.82rem] leading-5 text-text-soft">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {commentOpen ? (
            <form className={['flex gap-2', post.comments.length > 0 ? 'mt-2' : ''].join(' ')} onSubmit={handleCommentSubmit}>
              <input
                className="min-w-0 flex-1 rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-border-strong"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Написать комментарий"
                value={draft}
              />
              <IconButton active={Boolean(draft.trim())} icon={Send} label="Отправить комментарий" type="submit" />
            </form>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

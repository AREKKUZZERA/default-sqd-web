import { Bookmark, Heart, MessageCircle, Pencil, Repeat2, Send, Share2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import Avatar from '../../shared/ui/Avatar.jsx';
import IconButton from '../../shared/ui/IconButton.jsx';
import Panel from '../../shared/ui/Panel.jsx';

const INITIAL_VISIBLE_COMMENTS = 10;

const activityIconByType = {
  bookmark: Bookmark,
  like: Heart,
  post: Pencil,
  repost: Repeat2,
};

export default function PostCard({
  compact = false,
  currentUser,
  post,
  onComment,
  onDelete,
  onDeleteComment,
  onOpenProfile,
  onToggle,
  onUpdateComment,
  onUpdatePost,
  activityLabel = '',
  activityType = '',
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [postError, setPostError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [editingPost, setEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState(post.text);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [busyCommentId, setBusyCommentId] = useState(null);
  const [visibleCommentCount, setVisibleCommentCount] = useState(INITIAL_VISIBLE_COMMENTS);
  const [shared, setShared] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const commentInputRef = useRef(null);
  const replyCount = post.comments.length;
  const hiddenCommentCount = Math.max(0, replyCount - visibleCommentCount);
  const visibleComments = post.comments.slice(Math.max(0, replyCount - visibleCommentCount));
  const commentsId = `post-comments-${post.id}`;
  const tags = post.tags?.length ? post.tags : [post.tag].filter(Boolean);
  const isOwner = currentUser?.id === post.ownerId;
  const cardTone = isOwner ? 'post-card--own' : 'post-card--other';
  const activityTone = activityType || 'post';
  const ActivityIcon = activityIconByType[activityTone] || Pencil;
  const activityTypeLabel = {
    bookmark: 'сохранено',
    like: 'лайк',
    post: 'публикация',
    repost: 'репост',
  }[activityTone] || 'активность';

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text) {
      return;
    }

    try {
      setCommentError('');
      await onComment(post.id, text);
      setDraft('');
      window.requestAnimationFrame(() => commentInputRef.current?.focus());
    } catch (error) {
      setCommentError(error.message);
    }
  };

  const handleDelete = async () => {
    if (!isOwner || busyDelete) {
      return;
    }

    const confirmed = window.confirm('Удалить этот пост? Это действие нельзя отменить.');

    if (!confirmed) {
      return;
    }

    try {
      setBusyDelete(true);
      setPostError('');
      await onDelete(post.id);
    } catch (error) {
      setPostError(error.message);
    } finally {
      setBusyDelete(false);
    }
  };

  const handlePostUpdate = async () => {
    const text = postDraft.trim();

    if (!text || busyDelete) {
      return;
    }

    try {
      setBusyDelete(true);
      setPostError('');
      await onUpdatePost(post.id, text);
      setEditingPost(false);
    } catch (error) {
      setPostError(error.message);
    } finally {
      setBusyDelete(false);
    }
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingDraft(comment.text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingDraft('');
  };

  const handleUpdateComment = async (commentId) => {
    const text = editingDraft.trim();

    if (!text || busyCommentId) {
      return;
    }

    try {
      setBusyCommentId(commentId);
      setCommentError('');
      await onUpdateComment(commentId, text);
      cancelEditComment();
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setBusyCommentId(null);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (busyCommentId) {
      return;
    }

    const confirmed = window.confirm('Удалить комментарий?');

    if (!confirmed) {
      return;
    }

    try {
      setBusyCommentId(commentId);
      setCommentError('');
      await onDeleteComment(commentId);

      if (editingCommentId === commentId) {
        cancelEditComment();
      }
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setBusyCommentId(null);
    }
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

  const handleToggle = async (key) => {
    try {
      setPostError('');
      await onToggle(post.id, key);
    } catch (error) {
      setPostError(error.message);
    }
  };

  return (
    <Panel as="article" className={[compact ? 'p-3' : 'p-3.5 sm:p-4', cardTone, 'post-card transition'].join(' ')}>
      {activityLabel ? (
        <div
          className={[
            'activity-ribbon mb-3 flex flex-wrap items-center gap-2 rounded-sqd-sm border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.08em]',
            `activity-ribbon--${activityTone}`,
          ].join(' ')}
        >
          <span className="activity-ribbon__icon" aria-hidden="true">
            <ActivityIcon size={13} strokeWidth={1.8} />
          </span>
          <span className="activity-ribbon__type">{activityTypeLabel}</span>
          <span className="activity-ribbon__label">{activityLabel}</span>
        </div>
      ) : null}
      <div className="flex gap-2.5 sm:gap-3">
        <button
          aria-label={`Открыть профиль ${post.author}`}
          className="self-start rounded-sqd-sm text-left transition hover:opacity-85"
          onClick={() => onOpenProfile?.(post.ownerId)}
          type="button"
        >
          <Avatar image={post.avatarImage} label={post.avatar} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              className="font-ui text-[0.95rem] font-bold leading-5 text-text transition hover:text-text-soft"
              onClick={() => onOpenProfile?.(post.ownerId)}
              type="button"
            >
              {post.author}
            </button>
            <span className="post-meta font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
              @{post.userId} / {post.time}
            </span>
            {tags.map((tag) => (
              <span className="post-tag rounded-sqd-xs border border-border bg-accent-soft px-1.5 py-0.5 font-mono text-[0.56rem] font-extrabold uppercase tracking-[0.08em] text-text" key={tag}>
                #{tag}
              </span>
            ))}
            {isOwner ? (
              <span className="ml-auto inline-flex flex-wrap justify-end gap-1">
                <button
                  className="inline-flex h-8 items-center gap-1 rounded-sqd-xs border border-border bg-surface-2/60 px-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted transition hover:border-border-strong hover:text-text disabled:opacity-50"
                  disabled={busyDelete}
                  onClick={() => {
                    setEditingPost(true);
                    setPostDraft(post.text);
                  }}
                  type="button"
                >
                  <Pencil size={13} strokeWidth={1.8} />
                  изменить
                </button>
                <button
                  className="inline-flex h-8 items-center gap-1 rounded-sqd-xs border border-border bg-surface-2/60 px-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted transition hover:border-warning/60 hover:bg-warning/10 hover:text-warning disabled:opacity-50"
                  disabled={busyDelete}
                  onClick={handleDelete}
                  type="button"
                >
                  <Trash2 size={13} strokeWidth={1.8} />
                  удалить
                </button>
                </span>
            ) : null}
          </div>

          {editingPost ? (
            <div className="mt-2 grid gap-2">
              <textarea
                className="min-h-28 resize-none rounded-sqd-xs border border-border bg-bg-soft/75 p-3 text-sm leading-6 text-text outline-none focus:border-border-strong"
                maxLength={280}
                onChange={(event) => setPostDraft(event.target.value)}
                value={postDraft}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-sqd-xs border border-border-strong bg-accent-soft px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text disabled:opacity-50"
                  disabled={!postDraft.trim() || busyDelete}
                  onClick={handlePostUpdate}
                  type="button"
                >
                  сохранить
                </button>
                <button
                  className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-soft hover:border-border-strong hover:text-text"
                  onClick={() => setEditingPost(false)}
                  type="button"
                >
                  отменить
                </button>
              </div>
            </div>
          ) : (
            <p className={[compact ? 'mt-1.5 leading-5' : 'mt-2 leading-6', 'max-w-3xl whitespace-pre-wrap text-[0.92rem] text-text-soft'].join(' ')}>
              {post.text}
              {post.edited ? <span className="ml-2 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted">изменено</span> : null}
              {post.pending ? <span className="ml-2 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted">сохраняется</span> : null}
            </p>
          )}

          {postError ? <p className="mt-2 rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{postError}</p> : null}

          <div className="post-actions mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
            <IconButton active={post.liked} icon={Heart} label="Лайк" onClick={() => handleToggle('liked')}>
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
            <IconButton active={post.reposted} icon={Repeat2} label="Репост" onClick={() => handleToggle('reposted')}>
              {post.reposts}
            </IconButton>
            <IconButton active={post.bookmarked} icon={Bookmark} label="В избранное" onClick={() => handleToggle('bookmarked')} />
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

              {hiddenCommentCount > 0 ? (
                <button
                  className="mb-2 rounded-sqd-xs border border-border bg-surface-2/65 px-3 py-2 text-sm text-text-soft transition hover:border-border-strong hover:bg-surface-3/80 hover:text-text"
                  onClick={() => setVisibleCommentCount((count) => count + INITIAL_VISIBLE_COMMENTS)}
                  type="button"
                >
                  Показать ещё {Math.min(hiddenCommentCount, INITIAL_VISIBLE_COMMENTS)}
                </button>
              ) : null}

              <div className="grid gap-1.5">
                {visibleComments.map((comment) => {
                  const ownComment = currentUser?.id === comment.authorId;
                  const editing = editingCommentId === comment.id;
                  const busy = busyCommentId === comment.id;

                  return (
                  <div className={["comment-card flex gap-2 rounded-sqd-sm border p-2.5", ownComment ? "comment-card--own border-positive/25 bg-positive-soft/20" : "border-border bg-bg-soft/80"].join(' ')} key={comment.id}>
                    <button
                      aria-label={`Открыть профиль ${comment.author}`}
                      className="self-start rounded-sqd-sm text-left transition hover:opacity-85"
                      onClick={() => onOpenProfile?.(comment.authorId)}
                      type="button"
                    >
                      <Avatar image={comment.avatarImage} label={comment.avatar} size="sm" />
                      </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          className="font-ui text-[0.82rem] font-bold leading-4 text-text transition hover:text-text-soft"
                          onClick={() => onOpenProfile?.(comment.authorId)}
                          type="button"
                        >
                          {comment.author}
                        </button>
                        <span className="font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted">
                          {comment.pending ? 'отправляется' : comment.time}
                          {comment.edited && !comment.pending ? ' / изменено' : ''}
                        </span>
                        {ownComment ? (
                          <span className="ml-auto inline-flex gap-1">
                            <button
                              aria-label="Редактировать комментарий"
                              className="grid size-7 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-border-strong hover:text-text disabled:opacity-50"
                              disabled={busy || comment.pending}
                              onClick={() => startEditComment(comment)}
                              type="button"
                            >
                              <Pencil size={13} strokeWidth={1.8} />
                            </button>
                            <button
                              aria-label="Удалить комментарий"
                              className="grid size-7 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-warning/60 hover:text-warning disabled:opacity-50"
                              disabled={busy || comment.pending}
                              onClick={() => handleDeleteComment(comment.id)}
                              type="button"
                            >
                              <Trash2 size={13} strokeWidth={1.8} />
                            </button>
                          </span>
                        ) : null}
                      </div>
                      {editing ? (
                        <div className="mt-2 grid gap-2">
                          <textarea
                            className="min-h-20 resize-none rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-5 text-text outline-none focus:border-border-strong"
                            maxLength={280}
                            onChange={(event) => setEditingDraft(event.target.value)}
                            value={editingDraft}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-sqd-xs border border-border-strong bg-accent-soft px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text disabled:opacity-50"
                              disabled={!editingDraft.trim() || busy}
                              onClick={() => handleUpdateComment(comment.id)}
                              type="button"
                            >
                              сохранить
                            </button>
                            <button
                              className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-soft hover:border-border-strong hover:text-text"
                              onClick={cancelEditComment}
                              type="button"
                            >
                              отменить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-[0.82rem] leading-5 text-text-soft">{comment.text}</p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {commentOpen ? (
            <>
              <form className={['flex gap-2', post.comments.length > 0 ? 'mt-2' : ''].join(' ')} onSubmit={handleCommentSubmit}>
                <input
                  className="min-w-0 flex-1 rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-border-strong"
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={280}
                  placeholder="Написать комментарий"
                  ref={commentInputRef}
                  value={draft}
                />
                <IconButton active={Boolean(draft.trim())} icon={Send} label="Отправить комментарий" type="submit" />
              </form>
              {commentError ? <p className="mt-2 rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{commentError}</p> : null}
            </>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

import { Bookmark, Flag, Heart, MessageCircle, Pencil, Repeat2, Send, Share2, ShieldAlert, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import Avatar from '../../shared/ui/Avatar.jsx';
import ConfirmDialog from '../../shared/ui/ConfirmDialog.jsx';
import IconButton from '../../shared/ui/IconButton.jsx';
import Panel from '../../shared/ui/Panel.jsx';

const INITIAL_VISIBLE_COMMENTS = 10;

const activityIconByType = {
  bookmark: Bookmark,
  like: Heart,
  post: Pencil,
  repost: Repeat2,
};

const getPostUrl = (postId) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const normalizedBase = basePath === '/' ? '' : basePath;
  return `${window.location.origin}${normalizedBase}/post/${encodeURIComponent(postId)}`;
};

export default function PostCard({
  compact = false,
  currentUser,
  post,
  onComment,
  onDelete,
  onDeleteComment,
  onOpenProfile,
  onReport,
  onModerateUser,
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
  const [postBusy, setPostBusy] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const commentInputRef = useRef(null);
  const replyCount = post.comments.length;
  const hiddenCommentCount = Math.max(0, replyCount - visibleCommentCount);
  const visibleComments = post.comments.slice(Math.max(0, replyCount - visibleCommentCount));
  const commentsId = `post-comments-${post.id}`;
  const tags = post.tags?.length ? post.tags : [post.tag].filter(Boolean);
  const isOwner = currentUser?.id === post.ownerId;
  const canModerate = ['admin', 'administrator', 'moderator', 'mod'].includes(String(currentUser?.role || '').toLowerCase());
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

    if (!text || commentSending) {
      return;
    }

    try {
      setCommentSending(true);
      setCommentError('');
      await onComment(post.id, text);
      setDraft('');
      window.requestAnimationFrame(() => commentInputRef.current?.focus());
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setCommentSending(false);
    }
  };

  const requestDeletePost = () => {
    if (!isOwner || postBusy) {
      return;
    }

    setConfirmAction({ type: 'post' });
  };

  const handlePostUpdate = async () => {
    const text = postDraft.trim();

    if (!text || postBusy) {
      return;
    }

    try {
      setPostBusy(true);
      setPostError('');
      await onUpdatePost(post.id, text);
      setEditingPost(false);
    } catch (error) {
      setPostError(error.message);
    } finally {
      setPostBusy(false);
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

  const requestDeleteComment = (commentId) => {
    if (busyCommentId) {
      return;
    }

    setConfirmAction({ commentId, type: 'comment' });
  };

  const confirmDangerAction = async () => {
    if (!confirmAction) {
      return;
    }

    try {
      if (confirmAction.type === 'post') {
        setPostBusy(true);
        setPostError('');
        await onDelete(post.id);
        return;
      }

      setBusyCommentId(confirmAction.commentId);
      setCommentError('');
      await onDeleteComment(confirmAction.commentId);

      if (editingCommentId === confirmAction.commentId) {
        cancelEditComment();
      }
    } catch (error) {
      if (confirmAction.type === 'post') {
        setPostError(error.message);
      } else {
        setCommentError(error.message);
      }
    } finally {
      setPostBusy(false);
      setBusyCommentId(null);
      setConfirmAction(null);
    }
  };

  const handleShare = async () => {
    const shareText = `${post.author}: ${post.text}`;
    const url = getPostUrl(post.id);

    try {
      if (navigator.share) {
        await navigator.share({ title: 'default squad', text: shareText, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url || shareText);
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
            <span className="post-meta font-mono text-[0.7rem] tracking-[0.03em] text-muted">
              @{post.userId} / {post.time}
            </span>
            {tags.map((tag) => (
              <span className="post-tag rounded-sqd-xs border border-border bg-accent-soft px-1.5 py-0.5 font-mono text-[0.58rem] font-extrabold uppercase tracking-[0.08em] text-text" key={tag}>
                #{tag}
              </span>
            ))}
            {isOwner || post.ownerId !== currentUser?.id ? (
              <span className="ml-auto inline-flex flex-wrap justify-end gap-1">
                {isOwner ? (
                  <>
                    <button
                      className="inline-flex min-h-10 items-center gap-1 rounded-sqd-xs border border-border bg-surface-2/60 px-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted transition hover:border-border-strong hover:text-text disabled:opacity-50 sm:min-h-8"
                      disabled={postBusy}
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
                      className="inline-flex min-h-10 items-center gap-1 rounded-sqd-xs border border-border bg-surface-2/60 px-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted transition hover:border-warning/60 hover:bg-warning/10 hover:text-warning disabled:opacity-50 sm:min-h-8"
                      disabled={postBusy}
                      onClick={requestDeletePost}
                      type="button"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                      удалить
                    </button>
                  </>
                ) : null}
                {!isOwner ? (
                  <button
                    className="inline-flex min-h-10 items-center gap-1 rounded-sqd-xs border border-border bg-surface-2/60 px-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted transition hover:border-warning/60 hover:bg-warning/10 hover:text-warning sm:min-h-8"
                    onClick={() => onReport?.({ postId: post.id, targetLabel: `пост ${post.author}`, targetUserId: post.ownerId })}
                    type="button"
                  >
                    <Flag size={13} strokeWidth={1.8} />
                    жалоба
                  </button>
                ) : null}
                {canModerate && !isOwner ? (
                  <button
                    className="inline-flex min-h-10 items-center gap-1 rounded-sqd-xs border border-warning/45 bg-warning/10 px-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-warning transition hover:border-warning/70 sm:min-h-8"
                    onClick={() => onModerateUser?.(post.ownerId)}
                    type="button"
                  >
                    <ShieldAlert size={13} strokeWidth={1.8} />
                    модерировать
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>

          {editingPost ? (
            <div className="mt-2 grid gap-2">
              <textarea
                className="min-h-28 resize-none rounded-sqd-xs border border-border bg-bg-soft/75 p-3 text-sm leading-6 text-text outline-none focus:border-border-strong"
                maxLength={280}
                name="post-edit-body"
                onChange={(event) => setPostDraft(event.target.value)}
                value={postDraft}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-10 rounded-sqd-xs border border-border-strong bg-accent-soft px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text disabled:opacity-50"
                  disabled={!postDraft.trim() || postBusy}
                  onClick={handlePostUpdate}
                  type="button"
                >
                  {postBusy ? 'сохраняем...' : 'сохранить'}
                </button>
                <button
                  className="min-h-10 rounded-sqd-xs border border-border bg-surface-2/70 px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-soft hover:border-border-strong hover:text-text"
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

          {shared ? <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-positive">ссылка скопирована</p> : null}
        </div>
      </div>

      {commentOpen ? (
        <div className="post-comments post-comments--open" id={commentsId}>
          <div className="post-comments__inner mt-3 border-t border-border pt-3">
            {post.comments.length > 0 ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.08em] text-muted">Комментарии</p>
                  <span className="font-mono text-[0.64rem] text-muted">{replyCount}</span>
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
                      <div
                        className={[
                          'comment-card flex gap-2 rounded-sqd-sm border p-2.5',
                          ownComment ? 'comment-card--own border-positive/25 bg-positive-soft/20' : 'border-border bg-bg-soft/80',
                        ].join(' ')}
                        key={comment.id}
                      >
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
                            <span className="font-mono text-[0.62rem] tracking-[0.03em] text-muted">
                              {comment.pending ? 'отправляется' : comment.time}
                              {comment.edited && !comment.pending ? ' / изменено' : ''}
                            </span>
                            {ownComment || !comment.pending ? (
                              <span className="ml-auto inline-flex gap-1">
                                {ownComment ? (
                                  <>
                                    <button
                                      aria-label="Редактировать комментарий"
                                      className="grid size-10 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-border-strong hover:text-text disabled:opacity-50 sm:size-8"
                                      disabled={busy || comment.pending}
                                      onClick={() => startEditComment(comment)}
                                      type="button"
                                    >
                                      <Pencil size={14} strokeWidth={1.8} />
                                    </button>
                                    <button
                                      aria-label="Удалить комментарий"
                                      className="grid size-10 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-warning/60 hover:text-warning disabled:opacity-50 sm:size-8"
                                      disabled={busy || comment.pending}
                                      onClick={() => requestDeleteComment(comment.id)}
                                      type="button"
                                    >
                                      <Trash2 size={14} strokeWidth={1.8} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    aria-label="Пожаловаться на комментарий"
                                    className="grid size-10 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-warning/60 hover:text-warning sm:size-8"
                                    onClick={() => onReport?.({ commentId: comment.id, targetLabel: `комментарий ${comment.author}`, targetUserId: comment.authorId })}
                                    type="button"
                                  >
                                    <Flag size={14} strokeWidth={1.8} />
                                  </button>
                                )}
                              </span>
                            ) : null}
                          </div>
                          {editing ? (
                            <div className="mt-2 grid gap-2">
                              <textarea
                                className="min-h-20 resize-none rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-5 text-text outline-none focus:border-border-strong"
                                maxLength={280}
                                name="comment-edit-body"
                                onChange={(event) => setEditingDraft(event.target.value)}
                                value={editingDraft}
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="min-h-10 rounded-sqd-xs border border-border-strong bg-accent-soft px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text disabled:opacity-50"
                                  disabled={!editingDraft.trim() || busy}
                                  onClick={() => handleUpdateComment(comment.id)}
                                  type="button"
                                >
                                  {busy ? 'сохраняем...' : 'сохранить'}
                                </button>
                                <button
                                  className="min-h-10 rounded-sqd-xs border border-border bg-surface-2/70 px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-soft hover:border-border-strong hover:text-text"
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

            <form className={['flex gap-2', post.comments.length > 0 ? 'mt-2' : ''].join(' ')} onSubmit={handleCommentSubmit}>
              <input
                className="min-w-0 flex-1 rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-border-strong"
                disabled={commentSending}
                maxLength={280}
                name="comment-body"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Написать комментарий"
                ref={commentInputRef}
                value={draft}
              />
              <IconButton
                active={Boolean(draft.trim())}
                disabled={!draft.trim() || commentSending}
                icon={Send}
                label="Отправить комментарий"
                type="submit"
              />
            </form>
            {commentError ? <p className="mt-2 rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">{commentError}</p> : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        busy={postBusy || Boolean(busyCommentId)}
        confirmLabel="Удалить"
        description={confirmAction?.type === 'post' ? 'Пост и все комментарии исчезнут из ленты.' : 'Комментарий будет удалён без восстановления.'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirmDangerAction}
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'post' ? 'Удалить пост?' : 'Удалить комментарий?'}
      />
    </Panel>
  );
}

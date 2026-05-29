import Panel from '../../shared/ui/Panel.jsx';
import PostCard from './PostCard.jsx';
import PostComposer from './PostComposer.jsx';

export default function Feed({
  activeAuthor,
  activeTopic = 'all',
  authors = [],
  compactMode,
  currentUser,
  hasMore = false,
  loadingMore = false,
  onAddPost,
  onClearPost,
  onClearTopic,
  onCommentPost,
  onDeleteComment,
  onDeletePost,
  onLoadMore,
  onOpenProfile,
  onSelectAuthor,
  onTogglePost,
  onUpdateComment,
  onUpdatePost,
  posts,
  query,
  selectedPostId,
}) {
  const activeAuthorMeta = authors.find((author) => author.value === activeAuthor && author.value !== 'all');
  const hasActiveFilters = Boolean(selectedPostId || activeTopic !== 'all' || activeAuthorMeta || query?.trim());

  return (
    <section className="min-w-0" id="feed">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="poster-title font-display text-4xl leading-none text-text sm:text-5xl">
            {selectedPostId ? 'Пост' : 'Лента'}
          </h1>
        </div>
        <div className="rounded-sqd-sm border border-border bg-surface/80 px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-text-soft">
          {posts.length} записей
        </div>
      </div>

      {hasActiveFilters ? (
        <Panel className="mb-4 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-soft">
            <span className="font-ui text-xs font-bold uppercase tracking-[0.08em] text-muted">Фильтр</span>
            {selectedPostId ? (
              <button className="filter-chip" onClick={onClearPost} type="button">
                пост #{String(selectedPostId).slice(0, 8)} ×
              </button>
            ) : null}
            {activeTopic !== 'all' ? (
              <button className="filter-chip" onClick={onClearTopic} type="button">
                #{activeTopic} ×
              </button>
            ) : null}
            {activeAuthorMeta ? (
              <button className="filter-chip" onClick={() => onSelectAuthor('all')} type="button">
                {activeAuthorMeta.label} ×
              </button>
            ) : null}
            {query?.trim() ? <span className="filter-chip filter-chip--static">поиск: {query.trim()}</span> : null}
          </div>
        </Panel>
      ) : null}

      {!selectedPostId ? (
        <Panel className="mb-4 p-3 sm:p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {authors.map((author) => (
              <button
                className={[
                  'author-filter min-w-fit rounded-sqd-xs border px-3 py-2 text-left transition',
                  activeAuthor === author.value
                    ? 'author-filter--active border-border-strong bg-accent-soft text-text shadow-[inset_0_-2px_0_var(--color-positive)]'
                    : 'border-border bg-surface-2/65 text-text-soft hover:border-border-strong hover:bg-surface-3/80 hover:text-text',
                ].join(' ')}
                key={author.value}
                onClick={() => onSelectAuthor(author.value)}
                type="button"
              >
                <span className="block max-w-36 truncate font-ui text-sm font-bold">{author.label}</span>
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted">{author.caption}</span>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {!selectedPostId ? (
        <div className="mb-4">
          <PostComposer currentUser={currentUser} onPost={onAddPost} />
        </div>
      ) : null}

      <div className="grid gap-3">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              compact={compactMode}
              currentUser={currentUser}
              key={post.id}
              onComment={onCommentPost}
              onDeleteComment={onDeleteComment}
              onDelete={onDeletePost}
              onOpenProfile={onOpenProfile}
              onToggle={onTogglePost}
              onUpdateComment={onUpdateComment}
              onUpdatePost={onUpdatePost}
              post={post}
            />
          ))
        ) : (
          <Panel className="p-8 text-center">
            <p className="font-ui text-lg font-bold text-text">{selectedPostId ? 'Пост не найден' : 'Пока пусто'}</p>
            <p className="mt-2 text-sm text-text-soft">
              {selectedPostId
                ? 'Ссылка могла устареть или у вас нет доступа к этому посту.'
                : query || activeTopic !== 'all' || activeAuthor !== 'all'
                  ? 'Попробуйте изменить поиск или фильтр.'
                  : 'Опубликуйте первый пост.'}
            </p>
          </Panel>
        )}
      </div>

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            className="poster-button rounded-sqd-xs border border-border bg-surface px-4 py-2 font-ui text-sm font-bold text-text transition hover:border-border-strong hover:bg-surface-2 disabled:cursor-wait disabled:text-muted"
            disabled={loadingMore}
            onClick={onLoadMore}
            type="button"
          >
            {loadingMore ? 'загружаем...' : 'показать ещё'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

import { stories } from '../../shared/data/socialData.js';
import Panel from '../../shared/ui/Panel.jsx';
import PostCard from './PostCard.jsx';
import PostComposer from './PostComposer.jsx';

export default function Feed({
  activeAuthor,
  compactMode,
  currentUser,
  onAddPost,
  onCommentPost,
  onSelectAuthor,
  onTogglePost,
  posts,
  query,
}) {
  return (
    <section className="min-w-0" id="feed">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="y2k-label mb-2">lookup_pack / v2</span>
          <h1 className="poster-title font-display text-5xl leading-none text-text">Лента</h1>
        </div>
        <div className="rounded-sqd-sm border border-border bg-surface/80 px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em] text-text-soft">
          {posts.length} записей
        </div>
      </div>

      <Panel className="mb-4 p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {stories.map((story) => (
            <button
              className={[
                'min-w-fit rounded-sqd-xs border px-3 py-2 text-left transition',
                activeAuthor === story.author
                  ? 'border-border-strong bg-accent-soft text-text shadow-[inset_0_-2px_0_var(--color-positive)]'
                  : 'border-border bg-surface-2/65 text-text-soft hover:border-border-strong hover:bg-surface-3/80 hover:text-text',
              ].join(' ')}
              key={story.name}
              onClick={() => onSelectAuthor(story.author)}
              type="button"
            >
              <span className="block font-ui text-sm font-bold">{story.name}</span>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted">
                {story.author === 'all' ? 'все авторы' : story.author}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="mb-4">
        <PostComposer currentUser={currentUser} onPost={onAddPost} />
      </div>

      <div className="grid gap-3">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard compact={compactMode} key={post.id} onComment={onCommentPost} onToggle={onTogglePost} post={post} />
          ))
        ) : (
          <Panel className="p-8 text-center">
            <p className="font-ui text-lg font-bold text-text">Ничего не найдено</p>
            <p className="mt-2 text-sm text-text-soft">
              {query ? 'Попробуйте изменить поиск или фильтр.' : 'В этой категории пока нет постов.'}
            </p>
          </Panel>
        )}
      </div>
    </section>
  );
}

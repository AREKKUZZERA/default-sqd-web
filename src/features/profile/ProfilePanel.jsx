import { Home, MessageCircle, UserCircle } from 'lucide-react';
import Avatar from '../../shared/ui/Avatar.jsx';
import Panel from '../../shared/ui/Panel.jsx';

const sidebarNavigation = [
  { icon: Home, label: 'Лента', target: 'feed' },
  { icon: MessageCircle, label: 'Сообщения', target: 'messages' },
  { icon: UserCircle, label: 'Профиль', target: 'profile' },
];

export default function ProfilePanel({ activeView, currentUser, onNavigate, onOpenProfile, onSelectTopic, trends }) {
  const visibleTrends = trends.slice(0, 5);

  return (
    <div className="grid gap-4">
      <Panel className="overflow-hidden">
        <button className="block w-full text-left" onClick={onOpenProfile} type="button">
          <div
            className="poster-band h-24 border-b border-border bg-cover bg-center"
            style={currentUser.bannerImage ? { backgroundImage: `url(${currentUser.bannerImage})` } : undefined}
          />
        </button>

        <div className="-mt-8 p-4">
          <div className="flex items-end justify-between gap-3">
            <button aria-label="Открыть профиль" onClick={onOpenProfile} type="button">
              <Avatar active image={currentUser.avatarImage} label={currentUser.avatar} size="lg" />
            </button>
            <span className="rounded-sqd-xs border border-positive/45 bg-positive-soft px-3 py-2 text-xs font-bold uppercase text-positive">
              {currentUser.status || 'online'}
            </span>
          </div>

          <button className="mt-4 block w-full text-left" onClick={onOpenProfile} type="button">
            <h2 className="poster-title font-display text-4xl leading-none text-text">{currentUser.name}</h2>
            <p className="mt-1 font-mono text-[0.68rem] text-muted">@{currentUser.userId}</p>
          </button>

          <p className="mt-4 text-sm leading-6 text-text-soft">{currentUser.bio || 'Профиль пока без описания.'}</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {currentUser.stats.map((stat) => (
              <div className="rounded-sqd-sm border border-border bg-surface-2/65 p-3" key={stat.label}>
                <p className="font-ui text-lg font-bold text-text">{stat.value}</p>
                <p className="mt-1 text-xs font-medium text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 text-sm text-text-soft">
            <span className="inline-flex items-center gap-2">
              <UserCircle size={15} strokeWidth={1.8} /> {currentUser.role || 'Member'}
            </span>
          </div>
        </div>
      </Panel>

      <Panel className="p-3">
        <nav aria-label="Основная навигация" className="grid gap-2">
          {sidebarNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={[
                  'flex w-full items-center gap-2 rounded-sqd-sm border px-3 py-3 text-left font-ui text-sm font-bold transition',
                  activeView === item.target
                    ? 'border-border-strong bg-accent-soft text-text shadow-[inset_3px_0_0_var(--color-positive)]'
                    : 'border-border bg-surface-2/65 text-text-soft hover:border-border-strong hover:bg-surface-3/80 hover:text-text',
                ].join(' ')}
                key={item.target}
                onClick={() => onNavigate(item.target)}
                type="button"
              >
                <Icon size={15} strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </Panel>

      <Panel className="hidden p-4 lg:block">
        <div className="mb-3">
          <h2 className="font-ui text-base font-bold text-text">Популярные темы</h2>
          <p className="mt-1 text-sm text-muted">5 самых частых хештегов в ленте</p>
        </div>
        <div className="grid gap-2">
          {visibleTrends.length > 0 ? (
            visibleTrends.map((trend) => (
              <button
                className="block w-full rounded-sqd-sm border border-border bg-surface-2/65 p-3 text-left transition hover:border-border-strong hover:bg-surface-3/80"
                key={trend.tag}
                onClick={() => onSelectTopic(trend.tag)}
                type="button"
              >
                <p className="font-ui text-sm font-bold text-text">{trend.label}</p>
                <p className="mt-1 font-mono text-[0.64rem] uppercase tracking-[0.08em] text-muted">{trend.count}</p>
              </button>
            ))
          ) : (
            <p className="rounded-sqd-sm border border-border bg-surface-2/65 p-3 text-sm text-text-soft">
              Темы появятся после публикации постов.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

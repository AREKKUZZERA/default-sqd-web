import { Home, MessageCircle } from 'lucide-react';
import Avatar from '../../shared/ui/Avatar.jsx';
import Panel from '../../shared/ui/Panel.jsx';
import PermissionBadges from '../../shared/ui/PermissionBadges.jsx';
import RolePill from '../../shared/ui/RolePill.jsx';

const sidebarNavigation = [
  { icon: Home, label: 'Лента', target: 'feed' },
  { icon: MessageCircle, label: 'Сообщения', target: 'messages' },
];

function getMiniNameStyle(name = '') {
  const length = Array.from(name || '').length;
  const size = Math.max(1.28, 1.82 - Math.max(0, length - 11) * 0.07);

  return { fontSize: `${size.toFixed(2)}rem` };
}

export default function ProfilePanel({ activeView, currentUser, onNavigate, onOpenProfile, onSelectTopic, trends }) {
  const visibleTrends = trends.slice(0, 5);

  return (
    <div className="grid gap-4">
      <Panel className="profile-mini-card overflow-hidden">
        <button className="block w-full text-left" onClick={onOpenProfile} type="button">
          <div
            className={[
              'profile-mini-band poster-band relative h-24 overflow-hidden border-b border-border',
              currentUser.bannerImage ? 'profile-band--media' : '',
            ].join(' ')}
          >
            {currentUser.bannerImage ? <img alt="" className="absolute inset-0 z-[3] block h-full w-full object-contain object-center" src={currentUser.bannerImage} /> : null}
          </div>
        </button>

        <div className="profile-mini-body p-4">
          <div className="profile-mini-head -mt-8 flex items-start gap-3">
            <button aria-label="Открыть профиль" onClick={onOpenProfile} type="button">
              <Avatar active={currentUser.isOnline} image={currentUser.avatarImage} label={currentUser.avatar} size="lg" status={currentUser.status} />
            </button>
            <button className="profile-mini-identity min-w-0 flex-1 text-left" onClick={onOpenProfile} type="button">
              <h2 className="profile-mini-name poster-title font-display leading-none text-text" style={getMiniNameStyle(currentUser.name)} title={currentUser.name}>{currentUser.name}</h2>
              <p className="mt-1 font-mono text-[0.68rem] text-muted">@{currentUser.userId}</p>
            </button>
          </div>

          <p className="profile-mini-bio mt-4 text-sm leading-6 text-text-soft">{currentUser.bio || 'Профиль пока без описания.'}</p>

          <div className="profile-mini-stats mt-4 grid grid-cols-3 gap-2">
            {currentUser.stats.map((stat) => (
              <div className="profile-mini-stat rounded-sqd-sm border border-border bg-surface-2/65 p-3" key={stat.label}>
                <p className="font-ui text-lg font-bold text-text">{stat.value}</p>
                <p className="mt-1 text-xs font-medium text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="profile-mini-access-row mt-4 flex flex-wrap items-center gap-2 text-sm text-text-soft">
            <RolePill role={currentUser.role} />
            <PermissionBadges permissions={currentUser.permissions} />
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
                  'side-nav-item flex w-full items-center gap-2 rounded-sqd-sm border px-3 py-3 text-left font-ui text-sm font-bold transition',
                  activeView === item.target
                    ? 'side-nav-item--active border-border-strong bg-accent-soft text-text shadow-[inset_3px_0_0_var(--color-positive)]'
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
                className="trend-card block w-full rounded-sqd-sm border border-border bg-surface-2/65 p-3 text-left transition hover:border-border-strong hover:bg-surface-3/80"
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

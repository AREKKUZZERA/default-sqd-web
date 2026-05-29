import { Bookmark, Heart, MessageCircle, Repeat2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import Avatar from '../../shared/ui/Avatar.jsx';
import Panel from '../../shared/ui/Panel.jsx';
import SectionTitle from '../../shared/ui/SectionTitle.jsx';
import PostCard from '../feed/PostCard.jsx';

const USER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_AVATAR_SIZE = 256 * 1024;
const MAX_BANNER_SIZE = 1024 * 1024;

const tabs = [
  { id: 'posts', label: 'Посты', icon: MessageCircle },
  { id: 'reposts', label: 'Репосты', icon: Repeat2 },
  { id: 'likes', label: 'Лайки', icon: Heart },
  { id: 'bookmarks', label: 'Избранное', icon: Bookmark },
];

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function ProfilePage({ currentUser, people, posts, onCommentPost, onDeletePost, onTogglePost, onUpdateProfile }) {
  const [activeTab, setActiveTab] = useState('posts');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    bio: currentUser.bio,
    name: currentUser.name,
    role: currentUser.role,
    userId: currentUser.userId,
  });
  const [formError, setFormError] = useState('');
  const [uploadError, setUploadError] = useState('');


  const usedUserIds = useMemo(
    () => new Set(people.filter((person) => person.id !== currentUser.id).map((person) => person.userId.toLowerCase())),
    [currentUser.id, people],
  );

  const profilePosts = useMemo(() => {
    const collections = {
      posts: posts.filter((post) => post.ownerId === currentUser.id),
      reposts: posts.filter((post) => post.reposted),
      likes: posts.filter((post) => post.liked),
      bookmarks: posts.filter((post) => post.bookmarked),
    };

    return collections[activeTab];
  }, [activeTab, currentUser.id, posts]);

  const saveProfile = (event) => {
    event.preventDefault();
    const normalizedUserId = draft.userId.trim();
    const normalizedName = draft.name.trim();

    if (!normalizedName) {
      setFormError('Имя не может быть пустым.');
      return;
    }

    if (!USER_ID_PATTERN.test(normalizedUserId)) {
      setFormError('ID может содержать только латиницу, цифры, дефис и нижнее подчеркивание.');
      return;
    }

    if (usedUserIds.has(normalizedUserId.toLowerCase())) {
      setFormError('Такой ID уже занят другим пользователем.');
      return;
    }

    setFormError('');
    onUpdateProfile((profile) => ({
      ...profile,
      ...draft,
      avatar: getInitials(normalizedName),
      name: normalizedName,
      userId: normalizedUserId,
    }));
    setEditing(false);
  };

  const handleImageUpload = async (event, field, maxSize) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('Можно загружать только изображения.');
      return;
    }

    if (file.size > maxSize) {
      setUploadError(field === 'avatarImage' ? 'Аватар должен быть не больше 256 кб.' : 'Баннер должен быть не больше 1 мб.');
      return;
    }

    try {
      const image = await readImageFile(file);
      setUploadError('');
      onUpdateProfile((profile) => ({ ...profile, [field]: image }));
    } catch {
      setUploadError('Не удалось прочитать файл.');
    }
  };

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Профиль';

  return (
    <section className="min-w-0">
      <Panel className="mb-4 overflow-hidden">
        <div className="y2k-barcode" aria-hidden="true" />
        <div
          className="poster-band h-36 border-b border-border bg-cover bg-center"
          style={currentUser.bannerImage ? { backgroundImage: `url(${currentUser.bannerImage})` } : undefined}
        />
        <div className="-mt-10 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Avatar active image={currentUser.avatarImage} label={currentUser.avatar} size="lg" />
            <button
              className="rounded-sqd-xs border border-border bg-surface-2/70 px-4 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:bg-surface-3/80 hover:text-text"
              onClick={() => {
                setEditing((value) => !value);
                setFormError('');
                setUploadError('');
              }}
              type="button"
            >
              {editing ? 'закрыть' : 'редактировать'}
            </button>
          </div>

          {editing ? (
            <form className="mt-5 grid gap-3 rounded-sqd-sm border border-border bg-bg-soft/75 p-4" onSubmit={saveProfile}>
              <label className="grid gap-1">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">Имя</span>
                <input
                  className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
                  onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
                  value={draft.name}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">Уникальный ID</span>
                <input
                  className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-strong"
                  onChange={(event) => setDraft((value) => ({ ...value, userId: event.target.value }))}
                  value={draft.userId}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">Роль</span>
                <input
                  className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
                  onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value }))}
                  value={draft.role}
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">О себе</span>
                <textarea
                  className="min-h-24 resize-none rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-6 text-text outline-none focus:border-border-strong"
                  onChange={(event) => setDraft((value) => ({ ...value, bio: event.target.value }))}
                  value={draft.bio}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 font-mono text-[0.64rem] uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:bg-surface-3/80">
                  <Upload size={15} strokeWidth={1.8} />
                  аватар до 256 кб
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleImageUpload(event, 'avatarImage', MAX_AVATAR_SIZE)}
                    type="file"
                  />
                </label>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 font-mono text-[0.64rem] uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:bg-surface-3/80">
                  <Upload size={15} strokeWidth={1.8} />
                  баннер до 1 мб
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleImageUpload(event, 'bannerImage', MAX_BANNER_SIZE)}
                    type="file"
                  />
                </label>
              </div>

              {formError || uploadError ? (
                <p className="rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                  {formError || uploadError}
                </p>
              ) : null}

              <button
                className="justify-self-start rounded-sqd-xs border border-border-strong bg-accent-soft px-4 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text transition hover:bg-surface-3/80"
                type="submit"
              >
                сохранить
              </button>
            </form>
          ) : null}

          <div className="mt-5">
            <span className="y2k-label mb-2">profile_id / world_wide</span>
            <h1 className="poster-title font-display text-5xl leading-none text-text">{currentUser.name}</h1>
            <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">
              @{currentUser.userId} / {currentUser.role}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-soft">{currentUser.bio}</p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {currentUser.stats.map((stat) => (
              <div className="rounded-sqd-sm border border-border bg-surface-2/65 p-4" key={stat.label}>
                <p className="font-ui text-2xl font-bold text-text">{stat.value}</p>
                <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="mb-4 inline-block p-2">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                aria-label={tab.label}
                className={[
                  'inline-flex size-11 items-center justify-center rounded-sqd-xs border transition',
                  activeTab === tab.id
                    ? 'border-border-strong bg-accent-soft text-text shadow-[inset_0_-2px_0_var(--color-positive)]'
                    : 'border-border bg-surface-2/65 text-text-soft hover:border-border-strong hover:bg-surface-3/80 hover:text-text',
                ].join(' ')}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                type="button"
              >
                <Icon size={17} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </Panel>

      <SectionTitle title={activeTabLabel} />

      <div className="grid gap-4">
        {profilePosts.length > 0 ? (
          profilePosts.map((post) => <PostCard currentUser={currentUser} key={post.id} onComment={onCommentPost} onDelete={onDeletePost} onToggle={onTogglePost} post={post} />)
        ) : (
          <Panel className="p-6 text-center">
            <p className="font-ui text-lg font-bold text-text">Здесь пока пусто</p>
            <p className="mt-2 text-sm text-text-soft">Новые действия появятся в этой категории профиля.</p>
          </Panel>
        )}
      </div>
    </section>
  );
}

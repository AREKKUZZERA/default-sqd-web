import { MessageCircle, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import Avatar from '../../shared/ui/Avatar.jsx';
import Panel from '../../shared/ui/Panel.jsx';
import SectionTitle from '../../shared/ui/SectionTitle.jsx';
import PostCard from '../feed/PostCard.jsx';

const USER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const IMAGE_PRESETS = {
  avatarImage: {
    help: 'Квадратное фото, лучше 512x512 или больше.',
    label: 'Аватар',
    targetHeight: 512,
    targetWidth: 512,
  },
  bannerImage: {
    help: 'Широкий баннер, рекомендуемый размер 1920x640 или больше.',
    label: 'Баннер',
    targetHeight: 640,
    targetWidth: 1920,
  },
};

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = source;
  });
}

async function cropImage({ offsetX, offsetY, source, targetHeight, targetWidth, zoom }) {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const baseScale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const scale = baseScale * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const maxOffsetX = Math.max(0, (width - targetWidth) / 2);
  const maxOffsetY = Math.max(0, (height - targetHeight) / 2);
  const x = (targetWidth - width) / 2 + (offsetX / 100) * maxOffsetX;
  const y = (targetHeight - height) / 2 + (offsetY / 100) * maxOffsetY;

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.fillStyle = '#15181b';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, x, y, width, height);

  return canvas.toDataURL('image/webp', 0.86);
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

export default function ProfilePage({
  currentUser,
  people,
  posts,
  profileUser = currentUser,
  missing = false,
  onCommentPost,
  onDeleteComment,
  onDeletePost,
  onMessage,
  onOpenProfile,
  onTogglePost,
  onUpdateComment,
  onUpdatePost,
  onUpdateProfile,
  requestedProfileKey = '',
}) {
  const [editing, setEditing] = useState(false);
  const isOwnProfile = currentUser.id === profileUser?.id;
  const [draft, setDraft] = useState({
    bio: profileUser?.bio || '',
    name: profileUser?.name || '',
    role: profileUser?.role || '',
    userId: profileUser?.userId || '',
  });
  const [formError, setFormError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [cropDraft, setCropDraft] = useState(null);

  const wallPosts = useMemo(() => {
    if (!profileUser?.id) {
      return [];
    }

    return posts.filter(
      (post) =>
        post.ownerId === profileUser.id ||
        post.likedBy?.includes(profileUser.id) ||
        post.repostedBy?.includes(profileUser.id) ||
        post.bookmarkedBy?.includes(profileUser.id),
    );
  }, [posts, profileUser]);

  const usedUserIds = useMemo(
    () => new Set(people.filter((person) => person.id !== profileUser?.id).map((person) => person.userId.toLowerCase())),
    [people, profileUser?.id],
  );

  const saveProfile = async (event) => {
    event.preventDefault();

    if (!isOwnProfile) {
      return;
    }

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

    try {
      setFormError('');
      await onUpdateProfile((profile) => ({
        ...profile,
        ...draft,
        avatar: getInitials(normalizedName),
        name: normalizedName,
        userId: normalizedUserId,
      }));
      setEditing(false);
    } catch (error) {
      setFormError(error.message);
    }
  };

  const handleImageUpload = async (event, field) => {
    const file = event.target.files?.[0];
    const preset = IMAGE_PRESETS[field];

    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('Можно загружать только изображения.');
      return;
    }

    try {
      const image = await readImageFile(file);
      setUploadError('');
      setCropDraft({
        ...preset,
        field,
        offsetX: 0,
        offsetY: 0,
        source: image,
        zoom: 1,
      });
    } catch {
      setUploadError('Не удалось прочитать файл.');
    }
  };

  const saveCrop = async () => {
    if (!cropDraft || !isOwnProfile) {
      return;
    }

    try {
      const image = await cropImage(cropDraft);
      setUploadError('');
      await onUpdateProfile((profile) => ({ ...profile, [cropDraft.field]: image }));
      setCropDraft(null);
    } catch (error) {
      setUploadError(error.message || 'Не удалось обработать изображение.');
    }
  };

  if (!profileUser && !missing) {
    return (
      <section className="min-w-0">
        <Panel className="p-8 text-center">
          <p className="font-ui text-lg font-bold text-text">Загружаем профиль...</p>
        </Panel>
      </section>
    );
  }

  if (missing || !profileUser) {
    return (
      <section className="min-w-0">
        <Panel className="p-8 text-center">
          <p className="font-ui text-lg font-bold text-text">Профиль не найден</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-soft">
            Пользователь @{requestedProfileKey || 'unknown'} удален, переименован или недоступен.
          </p>
        </Panel>
      </section>
    );
  }

  return (
    <section className="min-w-0">
      <Panel className="mb-4 overflow-hidden">
        <div
          className="poster-band h-36 border-b border-border bg-cover bg-center"
          style={profileUser.bannerImage ? { backgroundImage: `url(${profileUser.bannerImage})` } : undefined}
        />
        <div className="-mt-10 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Avatar active={profileUser.status === 'online'} image={profileUser.avatarImage} label={profileUser.avatar} size="lg" />
            {isOwnProfile ? (
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
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-sqd-xs border border-border-strong bg-accent-soft px-4 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text transition hover:bg-surface-3/80"
                onClick={() => onMessage?.(profileUser.id)}
                type="button"
              >
                <MessageCircle size={15} strokeWidth={1.8} />
                написать
              </button>
            )}
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
                <label className="grid cursor-pointer gap-1 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text-soft transition hover:border-border-strong hover:bg-surface-3/80">
                  <span className="inline-flex items-center justify-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.08em]">
                    <Upload size={15} strokeWidth={1.8} />
                    выбрать аватар
                  </span>
                  <span className="text-center text-xs normal-case tracking-normal text-muted">{IMAGE_PRESETS.avatarImage.help}</span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleImageUpload(event, 'avatarImage')}
                    type="file"
                  />
                </label>
                <label className="grid cursor-pointer gap-1 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text-soft transition hover:border-border-strong hover:bg-surface-3/80">
                  <span className="inline-flex items-center justify-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.08em]">
                  <Upload size={15} strokeWidth={1.8} />
                    выбрать баннер
                  </span>
                  <span className="text-center text-xs normal-case tracking-normal text-muted">{IMAGE_PRESETS.bannerImage.help}</span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleImageUpload(event, 'bannerImage')}
                    type="file"
                  />
                </label>
              </div>

              {cropDraft ? (
                <div className="grid gap-3 rounded-sqd-sm border border-border bg-surface-2/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-ui text-sm font-bold text-text">Кадрирование: {cropDraft.label}</p>
                      <p className="mt-1 text-xs text-muted">
                        Итоговый размер: {cropDraft.targetWidth}x{cropDraft.targetHeight}, WebP.
                      </p>
                    </div>
                    <button
                      className="rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-soft hover:border-border-strong hover:text-text"
                      onClick={() => setCropDraft(null)}
                      type="button"
                    >
                      отменить
                    </button>
                  </div>

                  <div
                    className="overflow-hidden rounded-sqd-sm border border-border bg-bg-soft"
                    style={{ aspectRatio: `${cropDraft.targetWidth} / ${cropDraft.targetHeight}` }}
                  >
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={cropDraft.source}
                      style={{
                        transform: `translate(${cropDraft.offsetX * 0.12}%, ${cropDraft.offsetY * 0.12}%) scale(${cropDraft.zoom})`,
                        transformOrigin: 'center',
                      }}
                    />
                  </div>

                  <label className="grid gap-1 text-xs text-muted">
                    Масштаб
                    <input
                      max="3"
                      min="1"
                      onChange={(event) => setCropDraft((value) => ({ ...value, zoom: Number(event.target.value) }))}
                      step="0.01"
                      type="range"
                      value={cropDraft.zoom}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-muted">
                    Сдвиг по горизонтали
                    <input
                      max="100"
                      min="-100"
                      onChange={(event) => setCropDraft((value) => ({ ...value, offsetX: Number(event.target.value) }))}
                      type="range"
                      value={cropDraft.offsetX}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-muted">
                    Сдвиг по вертикали
                    <input
                      max="100"
                      min="-100"
                      onChange={(event) => setCropDraft((value) => ({ ...value, offsetY: Number(event.target.value) }))}
                      type="range"
                      value={cropDraft.offsetY}
                    />
                  </label>
                  <button
                    className="justify-self-start rounded-sqd-xs border border-border-strong bg-accent-soft px-4 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text transition hover:bg-surface-3/80"
                    onClick={saveCrop}
                    type="button"
                  >
                    применить фото
                  </button>
                </div>
              ) : null}

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
            <h1 className="poster-title font-display text-5xl leading-none text-text">{profileUser.name}</h1>
            <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">
              @{profileUser.userId} / {profileUser.role}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-soft">{profileUser.bio || 'Профиль пока без описания.'}</p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {profileUser.stats.map((stat) => (
              <div className="rounded-sqd-sm border border-border bg-surface-2/65 p-4" key={stat.label}>
                <p className="font-ui text-2xl font-bold text-text">{stat.value}</p>
                <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <SectionTitle title="Стена" />

      <div className="grid gap-4">
        {wallPosts.length > 0 ? (
          wallPosts.map((post) => (
            <PostCard
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
          <Panel className="p-6 text-center">
            <p className="font-ui text-lg font-bold text-text">Стена пока пустая</p>
            <p className="mt-2 text-sm text-text-soft">Посты и публичная активность пользователя появятся здесь.</p>
          </Panel>
        )}
      </div>
    </section>
  );
}

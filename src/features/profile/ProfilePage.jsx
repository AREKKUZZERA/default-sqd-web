import { MessageCircle, Pencil, Upload, UserCircle, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import Avatar from '../../shared/ui/Avatar.jsx';
import Panel from '../../shared/ui/Panel.jsx';
import PermissionBadges from '../../shared/ui/PermissionBadges.jsx';
import SectionTitle from '../../shared/ui/SectionTitle.jsx';
import PostCard from '../feed/PostCard.jsx';

const USER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

function getProfileActivity(post, profileUser) {
  if (!profileUser?.id) {
    return { label: '', type: '' };
  }

  const name = profileUser.name || profileUser.userId || 'Пользователь';

  if (post.ownerId === profileUser.id) {
    return { label: `${name} опубликовал(а) пост`, type: 'post' };
  }

  if (post.repostedBy?.includes(profileUser.id)) {
    return { label: `${name} репостнул(а) запись`, type: 'repost' };
  }

  if (post.likedBy?.includes(profileUser.id)) {
    return { label: `${name} лайкнул(а) запись`, type: 'like' };
  }

  if (post.bookmarkedBy?.includes(profileUser.id)) {
    return { label: `${name} сохранил(а) запись`, type: 'bookmark' };
  }

  return { label: '', type: '' };
}

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas export failed.'));
        }
      },
      'image/webp',
      0.86,
    );
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

function getCropGeometry({ naturalHeight, naturalWidth, offsetX, offsetY, targetHeight, targetWidth, zoom }) {
  const baseScale = Math.max(targetWidth / naturalWidth, targetHeight / naturalHeight);
  const scale = baseScale * zoom;
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  const maxOffsetX = Math.max(0, (width - targetWidth) / 2);
  const maxOffsetY = Math.max(0, (height - targetHeight) / 2);

  return {
    height,
    width,
    x: (targetWidth - width) / 2 + (offsetX / 100) * maxOffsetX,
    y: (targetHeight - height) / 2 + (offsetY / 100) * maxOffsetY,
  };
}

function getCropOffsetLimits(cropDraft) {
  const { height, width } = getCropGeometry(cropDraft);

  return {
    maxOffsetX: Math.max(0, (width - cropDraft.targetWidth) / 2),
    maxOffsetY: Math.max(0, (height - cropDraft.targetHeight) / 2),
  };
}

function getCropPreviewStyle(cropDraft) {
  const { height, width, x, y } = getCropGeometry(cropDraft);

  return {
    height: `${(height / cropDraft.targetHeight) * 100}%`,
    left: `${(x / cropDraft.targetWidth) * 100}%`,
    position: 'absolute',
    top: `${(y / cropDraft.targetHeight) * 100}%`,
    width: `${(width / cropDraft.targetWidth) * 100}%`,
  };
}

async function cropImage({ source, targetHeight, targetWidth, ...geometry }) {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const { height, width, x, y } = getCropGeometry({
    ...geometry,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    targetHeight,
    targetWidth,
  });

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.fillStyle = '#15181b';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, x, y, width, height);

  return canvasToBlob(canvas);
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

function revokeObjectUrl(value) {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    URL.revokeObjectURL(value);
  }
}

function getDraftFromProfile(profile) {
  return {
    avatarImage: profile?.avatarImage || '',
    avatarImagePath: profile?.avatarImagePath || profile?.avatarImage || '',
    bannerImage: profile?.bannerImage || '',
    bannerImagePath: profile?.bannerImagePath || profile?.bannerImage || '',
    bio: profile?.bio || '',
    name: profile?.name || '',
    userId: profile?.userId || '',
  };
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
  onModerateUser,
  onReport,
  onTogglePost,
  onUploadProfileImage,
  onUpdateComment,
  onUpdatePost,
  onUpdateProfile,
  requestedProfileKey = '',
}) {
  const [editing, setEditing] = useState(false);
  const isOwnProfile = currentUser.id === profileUser?.id;
  const [draft, setDraft] = useState(() => getDraftFromProfile(profileUser));
  const [formError, setFormError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [cropDraft, setCropDraft] = useState(null);
  const [mediaDraft, setMediaDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const cropDragRef = useRef(null);

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
      setSaving(true);
      setFormError('');
      let avatarImagePath = draft.avatarImagePath;
      let bannerImagePath = draft.bannerImagePath;

      if (mediaDraft.avatarImage?.blob) {
        avatarImagePath = await onUploadProfileImage?.({ blob: mediaDraft.avatarImage.blob, field: 'avatarImage' });
      }

      if (mediaDraft.bannerImage?.blob) {
        bannerImagePath = await onUploadProfileImage?.({ blob: mediaDraft.bannerImage.blob, field: 'bannerImage' });
      }

      await onUpdateProfile((profile) => ({
        ...profile,
        ...draft,
        avatar: getInitials(normalizedName),
        avatarImage: avatarImagePath,
        avatarImagePath,
        bannerImage: bannerImagePath,
        bannerImagePath,
        name: normalizedName,
        role: profile.role,
        userId: normalizedUserId,
      }));
      setMediaDraft({});
      setEditing(false);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
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

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setUploadError('Файл больше 5 МБ. Сожмите изображение перед загрузкой.');
      return;
    }

    const source = URL.createObjectURL(file);

    try {
      const image = await loadImage(source);
      setUploadError('');
      revokeObjectUrl(cropDraft?.source);
      setCropDraft({
        ...preset,
        field,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        offsetX: 0,
        offsetY: 0,
        source,
        zoom: 1,
      });
    } catch {
      revokeObjectUrl(source);
      setUploadError('Не удалось прочитать файл.');
    }
  };

  const saveCrop = async () => {
    if (!cropDraft || !isOwnProfile) {
      return;
    }

    try {
      const blob = await cropImage(cropDraft);
      const previewUrl = URL.createObjectURL(blob);
      const previousPreview = draft[cropDraft.field];
      setUploadError('');
      setDraft((value) => ({ ...value, [cropDraft.field]: previewUrl, [`${cropDraft.field}Path`]: value[`${cropDraft.field}Path`] || '' }));
      setMediaDraft((value) => ({ ...value, [cropDraft.field]: { blob, previewUrl } }));
      revokeObjectUrl(cropDraft.source);
      revokeObjectUrl(previousPreview);
      setCropDraft(null);
    } catch (error) {
      setUploadError(error.message || 'Не удалось обработать изображение.');
    }
  };

  const startCropDrag = (event) => {
    if (!cropDraft) {
      return;
    }

    const { maxOffsetX, maxOffsetY } = getCropOffsetLimits(cropDraft);

    if (!maxOffsetX && !maxOffsetY) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      maxOffsetX,
      maxOffsetY,
      pointerId: event.pointerId,
      rect: event.currentTarget.getBoundingClientRect(),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: cropDraft.offsetX,
      startOffsetY: cropDraft.offsetY,
    };
  };

  const moveCropDrag = (event) => {
    const drag = cropDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const targetDeltaX = ((event.clientX - drag.startClientX) / drag.rect.width) * cropDraft.targetWidth;
    const targetDeltaY = ((event.clientY - drag.startClientY) / drag.rect.height) * cropDraft.targetHeight;

    setCropDraft((value) => ({
      ...value,
      offsetX: drag.maxOffsetX ? clamp(drag.startOffsetX + (targetDeltaX / drag.maxOffsetX) * 100, -100, 100) : 0,
      offsetY: drag.maxOffsetY ? clamp(drag.startOffsetY + (targetDeltaY / drag.maxOffsetY) * 100, -100, 100) : 0,
    }));
  };

  const stopCropDrag = (event) => {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
    }
  };

  const cancelProfileEdit = () => {
    revokeObjectUrl(cropDraft?.source);
    Object.values(mediaDraft).forEach((item) => revokeObjectUrl(item?.previewUrl));
    setDraft(getDraftFromProfile(profileUser));
    setMediaDraft({});
    setCropDraft(null);
    setEditing(false);
    setFormError('');
    setUploadError('');
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

  const displayedAvatarImage = editing ? draft.avatarImage || profileUser.avatarImage : profileUser.avatarImage;
  const displayedBannerImage = editing ? draft.bannerImage || profileUser.bannerImage : profileUser.bannerImage;

  return (
    <section className="min-w-0">
      <Panel className="mb-4 overflow-hidden">
        <div
          className="profile-hero-band poster-band aspect-[3/1] border-b border-border bg-cover bg-center"
          style={displayedBannerImage ? { backgroundImage: `url(${displayedBannerImage})` } : undefined}
        />
        <div className="-mt-10 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <Avatar active={profileUser.isOnline} image={displayedAvatarImage} label={profileUser.avatar} size="lg" />
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="profile-page-name poster-title font-display leading-none text-text" title={profileUser.name}>{profileUser.name}</h1>
              <div className="profile-meta-row mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">@{profileUser.userId}</span>
                <span className="role-pill inline-flex items-center gap-2 rounded-sqd-xs border px-3 py-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.08em]">
                  <UserCircle size={14} strokeWidth={1.8} />
                  роль: {profileUser.role || 'Member'}
                </span>
                <PermissionBadges permissions={profileUser.permissions} />
                <span
                  className={[
                    'status-pill inline-flex items-center rounded-sqd-xs border px-3 py-2 text-xs font-bold uppercase',
                    profileUser.isOnline ? 'status-pill--online' : 'status-pill--offline',
                  ].join(' ')}
                >
                  {profileUser.status || 'offline'}
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-text-soft">{profileUser.bio || 'Профиль пока без описания.'}</p>
            </div>

            {isOwnProfile ? (
              <button
                aria-label={editing ? 'Отменить редактирование профиля' : 'Редактировать профиль'}
                className="sqd-button grid size-10 shrink-0 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-text-soft transition hover:border-border-strong hover:bg-surface-3/80 hover:text-text sm:size-9"
                onClick={() => {
                  if (editing) {
                    cancelProfileEdit();
                    return;
                  }

                  setDraft(getDraftFromProfile(profileUser));
                  setFormError('');
                  setUploadError('');
                  setEditing(true);
                }}
                title={editing ? 'Отменить редактирование профиля' : 'Редактировать профиль'}
                type="button"
              >
                {editing ? <X size={15} strokeWidth={1.8} /> : <Pencil size={15} strokeWidth={1.8} />}
              </button>
            ) : (
              <button
                className="sqd-button inline-flex shrink-0 items-center gap-2 rounded-sqd-xs border border-border-strong bg-accent-soft px-4 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text transition hover:bg-surface-3/80"
                onClick={() => onMessage?.(profileUser.id)}
                type="button"
              >
                <MessageCircle size={15} strokeWidth={1.8} />
                написать
              </button>
            )}
          </div>

          {editing ? (
            <form className="mt-5 grid gap-4 rounded-sqd-sm border border-border bg-bg-soft/75 p-4" onSubmit={saveProfile}>
              <div>
                <p className="font-ui text-base font-bold text-text">Редактирование профиля</p>
                <p className="mt-1 text-sm text-muted">Изменения применятся после сохранения.</p>
              </div>

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
                    name="profile-avatar-image"
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
                    name="profile-banner-image"
                    onChange={(event) => handleImageUpload(event, 'bannerImage')}
                    type="file"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">Имя</span>
                  <input
                    className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
                    name="profile-name"
                    onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
                    value={draft.name}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">Уникальный ID</span>
                  <input
                    className="rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-strong"
                    name="profile-user-id"
                    onChange={(event) => setDraft((value) => ({ ...value, userId: event.target.value }))}
                    value={draft.userId}
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">О себе</span>
                <textarea
                  className="min-h-24 resize-none rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-6 text-text outline-none focus:border-border-strong"
                  name="profile-bio"
                  onChange={(event) => setDraft((value) => ({ ...value, bio: event.target.value }))}
                  value={draft.bio}
                />
              </label>

              {cropDraft ? (
                <div className="grid gap-3 rounded-sqd-sm border border-border bg-surface-2/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-ui text-sm font-bold text-text">Кадрирование: {cropDraft.label}</p>
                      <p className="mt-1 text-xs text-muted">
                        Перетащите изображение, затем при необходимости уточните масштаб. Итог: {cropDraft.targetWidth}x{cropDraft.targetHeight}, WebP.
                      </p>
                    </div>
                    <button
                      className="rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-soft hover:border-border-strong hover:text-text"
                      onClick={() => { revokeObjectUrl(cropDraft.source); setCropDraft(null); }}
                      type="button"
                    >
                      отменить
                    </button>
                  </div>

                  <div
                    className="relative touch-none overflow-hidden rounded-sqd-sm border border-border bg-bg-soft"
                    onPointerCancel={stopCropDrag}
                    onPointerDown={startCropDrag}
                    onPointerMove={moveCropDrag}
                    onPointerUp={stopCropDrag}
                    style={{ aspectRatio: `${cropDraft.targetWidth} / ${cropDraft.targetHeight}` }}
                  >
                    <img
                      alt=""
                      className="select-none"
                      draggable="false"
                      src={cropDraft.source}
                      style={getCropPreviewStyle(cropDraft)}
                    />
                  </div>

                  <label className="grid gap-1 text-xs text-muted">
                    Масштаб
                    <input
                      max="3"
                      min="1"
                      name="profile-crop-zoom"
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
                      name="profile-crop-offset-x"
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
                      name="profile-crop-offset-y"
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-sqd-xs border border-border-strong bg-accent-soft px-4 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text transition hover:bg-surface-3/80 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? 'сохраняем...' : 'сохранить'}
                </button>
                <button
                  className="rounded-sqd-xs border border-border bg-surface-2/70 px-4 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:bg-surface-3/80 hover:text-text"
                  onClick={cancelProfileEdit}
                  type="button"
                >
                  отмена
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {profileUser.stats.map((stat) => (
              <div className="profile-stat-card rounded-sqd-sm border border-border bg-surface-2/65 p-4" key={stat.label}>
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
          wallPosts.map((post) => {
            const activity = getProfileActivity(post, profileUser);

            return (
              <PostCard
                currentUser={currentUser}
                key={post.id}
                onComment={onCommentPost}
                onDeleteComment={onDeleteComment}
                onDelete={onDeletePost}
                onModerateUser={onModerateUser}
                onOpenProfile={onOpenProfile}
                onReport={onReport}
                onToggle={onTogglePost}
                onUpdateComment={onUpdateComment}
                onUpdatePost={onUpdatePost}
                post={post}
                activityLabel={activity.label}
                activityType={activity.type}
              />
            );
          })
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

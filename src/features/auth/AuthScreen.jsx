import { CircleCheck, Lock, LogIn, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';

const accessNotes = [
  {
    icon: UserRound,
    title: 'Доступ по приглашению',
    text: 'Используйте email и пароль, которые вам выдал администратор.',
  },
  {
    icon: ShieldCheck,
    title: 'Только для участников',
    text: 'После входа откроются лента, профиль и сообщения команды.',
  },
  {
    icon: CircleCheck,
    title: 'Профиль создастся сам',
    text: 'При первом входе его можно будет заполнить и обновить.',
  },
];

function getFriendlyAuthError(message) {
  if (!message) {
    return '';
  }

  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('invalid login') || normalizedMessage.includes('invalid credentials')) {
    return 'Неверный email или пароль.';
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Email еще не подтвержден. Обратитесь к администратору команды.';
  }

  if (normalizedMessage.includes('supabase') || normalizedMessage.includes('vite_supabase')) {
    return 'Вход временно недоступен. Сообщите администратору проекта.';
  }

  return message;
}

export default function AuthScreen({ error, loading = false, onSignIn, supabaseReady }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const displayedError = formError || (supabaseReady ? getFriendlyAuthError(error) : '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!email.trim() || !password) {
      setFormError('Введите email и пароль.');
      return;
    }

    try {
      setSubmitting(true);
      await onSignIn({ email, password });
    } catch (signInError) {
      setFormError(getFriendlyAuthError(signInError.message) || 'Не удалось войти. Проверьте данные и попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="poster-app auth-screen min-h-screen px-3 py-4 text-text sm:px-5 sm:py-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[var(--shell-width)] place-items-center sm:min-h-[calc(100vh-3rem)]">
        <div className="grid w-full max-w-[1100px] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-stretch">
          <div className="relative overflow-hidden rounded-sqd-md border border-border bg-bg-soft/90 p-4 shadow-[var(--shadow-panel)] backdrop-blur-md sm:p-6">
            <span className="y2k-label mb-4 max-w-full text-[0.58rem]">вход для участников</span>
            <h1 className="poster-title max-w-full font-display text-4xl leading-none text-text sm:text-5xl xl:text-6xl">
              default squad<span className="text-accent">.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-text-soft sm:mt-5 sm:text-base sm:leading-7">
              Закрытое пространство команды. Войдите по выданному аккаунту, чтобы открыть ленту, сообщения и свой профиль.
            </p>

            <div className="mt-6 grid auto-rows-fr gap-3 lg:mt-8">
              {accessNotes.map(({ icon: Icon, title, text }) => (
                <div
                  className="grid min-h-[112px] grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-sqd-sm border border-border bg-surface-2/65 p-4"
                  key={title}
                >
                  <span className="grid size-9 place-items-center rounded-sqd-xs border border-border bg-bg-soft/75 text-positive">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <div className="self-center">
                    <p className="font-ui text-sm font-bold leading-5 text-text">{title}</p>
                    <p className="mt-1.5 text-sm leading-6 text-text-soft">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form className="flex h-full flex-col rounded-sqd-md border border-border-strong bg-surface/92 p-4 shadow-[var(--shadow-panel)] backdrop-blur-md sm:p-5" onSubmit={handleSubmit}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="font-ui text-sm font-bold text-positive">Вход в аккаунт</p>
                <h2 className="mt-1 font-ui text-2xl font-bold text-text">Введите данные</h2>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-sqd-sm border border-border bg-accent-soft text-positive">
                <ShieldCheck size={20} strokeWidth={1.9} />
              </span>
            </div>

            {!supabaseReady ? (
              <p className="mb-4 rounded-sqd-xs border border-warning/45 bg-warning/10 px-3 py-2 text-sm text-warning">
                Вход временно недоступен. Сообщите администратору проекта.
              </p>
            ) : null}

            {loading ? (
              <p className="mb-4 rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm text-text-soft">Проверяем вход...</p>
            ) : null}

            {displayedError ? (
              <p className="mb-4 rounded-sqd-xs border border-warning/45 bg-warning/10 px-3 py-2 text-sm text-warning">
                {displayedError}
              </p>
            ) : null}

            <label className="grid gap-1.5">
              <span className="font-ui text-sm font-bold text-text-soft">Email</span>
              <div className="flex items-center gap-2 rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-3 transition-within focus-within:border-border-strong">
                <Mail size={16} strokeWidth={1.8} className="text-muted" />
                <input
                  autoComplete="email"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
                  disabled={!supabaseReady || submitting}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  value={email}
                />
              </div>
            </label>

            <label className="mt-3 grid gap-1.5">
              <span className="font-ui text-sm font-bold text-text-soft">Пароль</span>
              <div className="flex items-center gap-2 rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-3 transition-within focus-within:border-border-strong">
                <Lock size={16} strokeWidth={1.8} className="text-muted" />
                <input
                  autoComplete="current-password"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
                  disabled={!supabaseReady || submitting}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  type="password"
                  value={password}
                />
              </div>
            </label>

            <button
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-sqd-xs border border-border-strong bg-accent-soft px-4 font-ui text-sm font-bold text-text transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-3 disabled:text-muted"
              disabled={!supabaseReady || submitting || loading}
              type="submit"
            >
              <LogIn size={16} strokeWidth={1.9} />
              {submitting ? 'Входим...' : 'Войти'}
            </button>

            <div className="mt-6 grid gap-3 rounded-sqd-sm border border-border bg-bg-soft/60 p-4 text-sm text-text-soft lg:mt-auto">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-positive">
                  <UserRound size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-ui font-bold text-text">Нужен доступ?</p>
                  <p className="mt-0.5 leading-5">Попросите администратора создать аккаунт на ваш email.</p>
                </div>
              </div>
              <div className="border-t border-border pt-3 leading-6">
                Самостоятельной регистрации нет. Если пароль не подходит, запросите новый у администратора команды.
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

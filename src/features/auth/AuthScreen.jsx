import { Lock, LogIn, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

export default function AuthScreen({ error, loading = false, onSignIn, supabaseReady }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      setFormError(signInError.message || 'Не удалось войти.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="poster-app auth-screen min-h-screen px-4 py-6 text-text sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[var(--shell-width)] place-items-center">
        <div className="grid w-full max-w-[980px] gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,420px)] lg:items-stretch">
          <div className="relative overflow-hidden rounded-sqd-md border border-border bg-bg-soft/90 p-6 shadow-[var(--shadow-panel)] backdrop-blur-md">
            <div className="y2k-barcode mb-6" aria-hidden="true" />
            <span className="y2k-label mb-4">closed_access / auth</span>
            <h1 className="poster-title font-display text-5xl leading-none text-text sm:text-6xl">
              default squad<span className="text-accent">.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-text-soft">
              Закрытое пространство команды. Вход доступен только для аккаунтов, созданных администратором проекта.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['RLS', 'Доступ к данным только после авторизации.'],
                ['AUTH', 'Пароли хранятся в Supabase Auth, не в репозитории.'],
                ['SQD', 'Профиль создается автоматически при первом входе.'],
              ].map(([title, text]) => (
                <div className="rounded-sqd-sm border border-border bg-surface-2/65 p-4" key={title}>
                  <p className="font-mono text-[0.66rem] font-bold uppercase tracking-[0.1em] text-positive">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-text-soft">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <form className="rounded-sqd-md border border-border-strong bg-surface/92 p-5 shadow-[var(--shadow-panel)] backdrop-blur-md" onSubmit={handleSubmit}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.12em] text-muted">secure login</p>
                <h2 className="mt-1 font-ui text-2xl font-bold text-text">Авторизация</h2>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-sqd-sm border border-border bg-accent-soft text-positive">
                <ShieldCheck size={20} strokeWidth={1.9} />
              </span>
            </div>

            {!supabaseReady ? (
              <p className="mb-4 rounded-sqd-xs border border-warning/45 bg-warning/10 px-3 py-2 text-sm text-warning">
                Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.
              </p>
            ) : null}

            {loading ? (
              <p className="mb-4 rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm text-text-soft">Проверяем сессию...</p>
            ) : null}

            {error || formError ? (
              <p className="mb-4 rounded-sqd-xs border border-warning/45 bg-warning/10 px-3 py-2 text-sm text-warning">
                {formError || error}
              </p>
            ) : null}

            <label className="grid gap-1.5">
              <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted">Email</span>
              <input
                autoComplete="email"
                className="rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-border-strong"
                disabled={!supabaseReady || submitting}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@default.sqd"
                type="email"
                value={email}
              />
            </label>

            <label className="mt-3 grid gap-1.5">
              <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-muted">Пароль</span>
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
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-sqd-xs border border-border-strong bg-accent-soft px-4 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-3 disabled:text-muted"
              disabled={!supabaseReady || submitting || loading}
              type="submit"
            >
              <LogIn size={16} strokeWidth={1.9} />
              {submitting ? 'входим...' : 'войти'}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-muted">
              Регистрация на сайте отключена. Аккаунты создаются администратором через Supabase Auth.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

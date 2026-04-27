import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PasswordInput } from '@/components/PasswordInput.jsx';
import { apiFetch } from '@/lib/api';
import { loginFormSchema } from '@/lib/validation';

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const verified = params.get('verified') === '1';
  const sessionLost = params.get('reason') === 'session';

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = loginFormSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Некорректные данные');
      return;
    }
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      const raw = params.get('redirect');
      const safe =
        raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
      navigate(safe, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-1">Вход</h1>
        <p className="text-sm text-notion-muted mb-6">Base56</p>
        {verified ? (
          <p className="text-sm text-emerald-300/90 mb-4 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-3 py-2">
            Email подтверждён. Можно войти.
          </p>
        ) : null}
        {sessionLost ? (
          <p className="text-sm text-amber-200/95 mb-4 rounded-lg border border-amber-500/30 bg-amber-950/35 px-3 py-2">
            Сессия истекла или сервер перезапустился. Войдите снова — данные на сервере в порядке.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-notion-muted mb-1.5" htmlFor="login-identifier">
              Почта или логин
            </label>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-notion-muted mb-1.5" htmlFor="login-password">
              Пароль
            </label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-white text-notion-bg py-2.5 text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Войти
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-notion-muted">
          <Link to="/forgot-password" className="text-violet-300 hover:text-violet-200">
            Забыли пароль?
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-notion-muted">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-violet-300 hover:text-violet-200">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  );
}

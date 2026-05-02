import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PasswordInput } from '@/components/PasswordInput.jsx';
import { AuthThemeToggle } from '@/components/ThemeToggle.jsx';
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
    <div className="login-shell px-4">
      <AuthThemeToggle className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-10" />
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">B56</div>
          <div>
            <h1 className="login-title mb-0">Вход</h1>
            <p className="login-sub">Base56 — календарь для специалистов</p>
          </div>
        </div>
        {verified ? (
          <p className="text-sm text-emerald-400/95 mb-4 rounded-[var(--radius-sm)] border border-emerald-500/25 bg-emerald-950/40 px-3 py-2">
            Email подтверждён. Можно войти.
          </p>
        ) : null}
        {sessionLost ? (
          <p className="text-sm text-amber-200/95 mb-4 rounded-[var(--radius-sm)] border border-amber-500/30 bg-amber-950/35 px-3 py-2">
            Сессия истекла или сервер перезапустился. Войдите снова — данные на сервере в порядке.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="login-identifier">
              Почта или логин
            </label>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="login-password">
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
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <button type="submit" className="login-btn">
            Войти
          </button>
        </form>
        <div className="login-links">
          <Link to="/forgot-password">Забыли пароль?</Link>
          <span className="muted">
            Нет аккаунта? <Link to="/register">Регистрация</Link>
          </span>
        </div>
      </div>
    </div>
  );
}

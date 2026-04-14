import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PasswordInput } from '@/components/PasswordInput.jsx';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setResendMsg('');
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...(login.trim() ? { login: login.trim() } : {}),
        }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResendMsg('');
    setError('');
    setResending(true);
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
      setResendMsg('Если аккаунт есть и почта не подтверждена, письмо отправлено.');
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setResending(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
        <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Проверьте почту</h1>
          <p className="text-sm text-notion-muted mb-4">
            Мы отправили ссылку для подтверждения на <span className="text-white/90">{email}</span>.
          </p>
          <button
            type="button"
            disabled={resending}
            onClick={() => void resend()}
            className="text-sm text-violet-300 hover:text-violet-200 mb-4 disabled:opacity-50 disabled:pointer-events-none"
          >
            {resending ? 'Отправка…' : 'Отправить письмо снова'}
          </button>
          {resendMsg ? <p className="text-sm text-notion-muted mb-4">{resendMsg}</p> : null}
          <Link to="/login" className="inline-block text-sm text-white/90 hover:text-white">
            Ко входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-1">Регистрация</h1>
        <p className="text-sm text-notion-muted mb-6">Создайте аккаунт Base56</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-notion-muted mb-1.5" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-notion-muted mb-1.5" htmlFor="reg-login">
              Логин <span className="text-notion-muted/70">(необязательно; если пусто — как в почте до @)</span>
            </label>
            <input
              id="reg-login"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-notion-muted mb-1.5" htmlFor="reg-password">
              Пароль (не короче 8 символов)
            </label>
            <PasswordInput
              id="reg-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {submitting ? (
            <p className="text-xs text-notion-muted">Отправка письма на сервере — обычно несколько секунд…</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-white text-notion-bg py-2.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? 'Подождите…' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-notion-muted">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-violet-300 hover:text-violet-200">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

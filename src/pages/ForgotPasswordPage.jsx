import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { forgotPasswordSchema } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Некорректные данные');
      return;
    }
    try {
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(parsed.data) });
    } catch {
      /* всегда показываем успех */
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-1">Сброс пароля</h1>
        <p className="text-sm text-notion-muted mb-6">Укажите email — пришлём ссылку, если аккаунт найден.</p>
        {sent ? (
          <p className="text-sm text-notion-muted mb-4">
            Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-notion-muted mb-1.5" htmlFor="forgot-email">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50"
                required
              />
            </div>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-lg bg-white text-notion-bg py-2.5 text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Отправить ссылку
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-notion-muted">
          <Link to="/login" className="text-violet-300 hover:text-violet-200">
            Назад ко входу
          </Link>
        </p>
      </div>
    </div>
  );
}

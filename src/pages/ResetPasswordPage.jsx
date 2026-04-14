import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PasswordInput } from '@/components/PasswordInput.jsx';
import { apiFetch } from '@/lib/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
        <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl text-center">
          <p className="text-sm text-rose-300 mb-4">Нет токена в ссылке</p>
          <Link to="/login" className="text-violet-300 text-sm">
            Ко входу
          </Link>
        </div>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
        <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Пароль обновлён</h1>
          <Link to="/login" className="text-violet-300 hover:text-violet-200 text-sm font-medium">
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-1">Новый пароль</h1>
        <p className="text-sm text-notion-muted mb-6">Не короче 8 символов</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-notion-muted mb-1.5" htmlFor="reset-password">
              Пароль
            </label>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
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
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
}

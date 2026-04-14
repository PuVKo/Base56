import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token')?.trim();
    if (!token) {
      setStatus('error');
      setMessage('Нет токена в ссылке');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await apiFetch('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setStatus('ok');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setMessage(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-notion-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-notion-border bg-notion-surface/90 p-6 shadow-xl text-center">
        {status === 'loading' ? <p className="text-notion-muted">Подтверждение…</p> : null}
        {status === 'ok' ? (
          <>
            <h1 className="text-xl font-semibold text-white mb-2">Готово</h1>
            <p className="text-sm text-notion-muted mb-4">Email подтверждён. Теперь можно войти.</p>
            <Link to="/login?verified=1" className="text-violet-300 hover:text-violet-200 text-sm font-medium">
              Перейти ко входу
            </Link>
          </>
        ) : null}
        {status === 'error' ? (
          <>
            <h1 className="text-xl font-semibold text-rose-200 mb-2">Ошибка</h1>
            <p className="text-sm text-notion-muted mb-4">{message}</p>
            <Link to="/login" className="text-violet-300 hover:text-violet-200 text-sm">
              Ко входу
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

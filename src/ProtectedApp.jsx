import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import App from './App.jsx';
import { apiFetch } from '@/lib/api';

export function ProtectedApp() {
  const [state, setState] = useState(/** @type {'loading' | 'authed' | 'guest' | 'error'} */ ('loading'));
  const [currentUser, setCurrentUser] = useState(
    /** @type {{ id: string, email: string, login?: string | null, emailVerified?: boolean } | null} */ (null),
  );
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setLoadError(null);
    (async () => {
      try {
        const data = await apiFetch('/api/auth/me');
        if (!cancelled) {
          if (data?.user) {
            setCurrentUser(data.user);
            setState('authed');
          } else {
            setCurrentUser(null);
            setState('guest');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setCurrentUser(null);
          setLoadError(e instanceof Error ? e.message : String(e));
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-notion-bg text-notion-muted">Загрузка…</div>
    );
  }
  if (state === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-notion-bg text-notion-muted px-6 text-center max-w-md mx-auto">
        <p className="text-notion-fg font-medium mb-2">Не удалось связаться с сервером</p>
        <p className="text-sm mb-4 text-notion-muted break-words" role="status">
          {loadError ?? 'Неизвестная ошибка'}
        </p>
        <button
          type="button"
          onClick={() => setLoadAttempt((n) => n + 1)}
          className="px-4 py-2 rounded-lg border border-notion-border text-notion-fg hover:bg-notion-hover transition-colors text-sm font-medium"
        >
          Повторить
        </button>
      </div>
    );
  }
  if (state === 'guest') {
    return <Navigate to="/login" replace />;
  }
  return <App currentUser={currentUser} />;
}

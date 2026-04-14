import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import App from './App.jsx';
import { apiFetch } from '@/lib/api';

export function ProtectedApp() {
  const [state, setState] = useState(/** @type {'loading' | 'authed' | 'guest'} */ ('loading'));
  const [currentUser, setCurrentUser] = useState(
    /** @type {{ id: string, email: string, login?: string | null, emailVerified?: boolean } | null} */ (null),
  );

  useEffect(() => {
    let cancelled = false;
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
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setState('guest');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-notion-bg text-notion-muted">Загрузка…</div>
    );
  }
  if (state === 'guest') {
    return <Navigate to="/login" replace />;
  }
  return <App currentUser={currentUser} />;
}

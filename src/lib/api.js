const API_BASE = '';

const CSRF_EXACT = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
]);

function pathOnly(path) {
  const i = path.indexOf('?');
  return i === -1 ? path : path.slice(0, i);
}

function methodNeedsCsrf(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase());
}

function requestNeedsCsrfHeader(path, method) {
  if (!methodNeedsCsrf(method)) return false;
  const p = pathOnly(path);
  if (!p.startsWith('/api/')) return false;
  if (CSRF_EXACT.has(p)) return false;
  return true;
}

let csrfTokenCache = /** @type {string | null} */ (null);
let csrfInflight = /** @type {Promise<string> | null} */ (null);

/**
 * Сбросить кэш токена (например после logout — новая сессия).
 */
export function invalidateCsrfToken() {
  csrfTokenCache = null;
  csrfInflight = null;
}

async function fetchCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;
  if (!csrfInflight) {
    csrfInflight = (async () => {
      const res = await fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!res.ok || !data || typeof data.csrfToken !== 'string' || !data.csrfToken) {
        throw new Error('Не удалось получить CSRF-токен');
      }
      csrfTokenCache = data.csrfToken;
      return data.csrfToken;
    })().finally(() => {
      csrfInflight = null;
    });
  }
  return csrfInflight;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init = {}) {
  const method = init.method || 'GET';
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers && typeof init.headers === 'object' && !Array.isArray(init.headers)
      ? /** @type {Record<string, string>} */ (init.headers)
      : {}),
  };
  if (requestNeedsCsrfHeader(path, method)) {
    const tok = await fetchCsrfToken();
    headers['X-CSRF-Token'] = tok;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.error ? data.error : text || res.statusText;
    if (
      res.status === 401 &&
      typeof window !== 'undefined' &&
      !path.startsWith('/api/auth/') &&
      window.location.pathname !== '/login' &&
      window.location.pathname !== '/register'
    ) {
      const back = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?reason=session&redirect=${encodeURIComponent(back)}`);
    }
    if (res.status === 403 && typeof data === 'object' && data?.code === 'CSRF_FAILED') {
      invalidateCsrfToken();
    }
    throw new Error(String(msg));
  }
  return data;
}

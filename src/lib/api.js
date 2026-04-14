const API_BASE = '';

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
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
    throw new Error(String(msg));
  }
  return data;
}

import { randomBytes } from 'crypto';

/** Пути без проверки CSRF (bootstrap / публичные POST). */
const CSRF_EXEMPT_EXACT = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
]);

function pathKey(req) {
  const u = req.originalUrl || req.url || '';
  const q = u.indexOf('?');
  return q === -1 ? u : u.slice(0, q);
}

function isMutating(method) {
  const m = String(method || '').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

/**
 * Генерирует токен при первом обращении к сессии (saveUninitialized: false — запись только после записи в session).
 * @type {import('express').RequestHandler}
 */
export function ensureCsrfToken(req, res, next) {
  if (!req.session) return next();
  if (typeof req.session.csrfToken !== 'string' || req.session.csrfToken.length < 32) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  next();
}

/**
 * Для POST/PUT/PATCH/DELETE на /api/* кроме whitelist — нужен заголовок X-CSRF-Token == session.csrfToken.
 * @type {import('express').RequestHandler}
 */
export function requireCsrfUnlessExempt(req, res, next) {
  if (!isMutating(req.method)) return next();
  const p = pathKey(req);
  if (!p.startsWith('/api/')) return next();
  if (CSRF_EXEMPT_EXACT.has(p)) return next();
  const header = String(req.get('X-CSRF-Token') ?? req.get('x-csrf-token') ?? '').trim();
  const sessionToken = req.session?.csrfToken;
  if (!header || typeof sessionToken !== 'string' || header !== sessionToken) {
    res.status(403).json({ error: 'CSRF: неверный или отсутствует токен', code: 'CSRF_FAILED' });
    return;
  }
  next();
}

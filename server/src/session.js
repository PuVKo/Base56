import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import createFileStore from 'session-file-store';
import pg from 'pg';
import { pgConnectionOptions } from './pgSslConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sessionSecret() {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[Base56] FATAL: задайте SESSION_SECRET (≥16 символов) в переменных приложения — иначе процесс не стартует.',
    );
    throw new Error('Задайте SESSION_SECRET (не короче 16 символов) для production');
  }
  return 'dev-base56-session-secret-not-for-production';
}

/**
 * @returns {import('express').RequestHandler}
 */
export function createSessionMiddleware() {
  const secret = sessionSecret();
  const isProd = process.env.NODE_ENV === 'production';
  const dbUrl = process.env.DATABASE_URL?.trim() ?? '';
  const isPostgres = Boolean(dbUrl && !dbUrl.startsWith('file:'));
  /** В production без HTTPS cookie с secure:true не уходит в браузер — разрешаем выключить. */
  const cookieSecure =
    process.env.SESSION_COOKIE_SECURE === '0' ? false : Boolean(isProd);

  const base = {
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    name: 'base56.sid',
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
    },
  };

  if (isPostgres) {
    const PgSession = connectPgSimple(session);
    const pool = new pg.Pool(pgConnectionOptions(dbUrl));
    return session({
      ...base,
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: false,
      }),
    });
  }

  // session-file-store делает atomic rename; на Windows с антивирусом/индексацией часто EPERM.
  if (process.platform === 'win32' && !isProd) {
    return session({
      ...base,
      store: new session.MemoryStore(),
    });
  }

  const sessionsDir = path.join(__dirname, '..', '.sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  const FileStore = createFileStore(session);
  return session({
    ...base,
    store: new FileStore({
      path: sessionsDir,
      logFn: () => {},
    }),
  });
}

/** @type {import('express').RequestHandler} */
export function requireAuth(req, res, next) {
  const uid = req.session?.userId;
  if (!uid || typeof uid !== 'string') {
    res.status(401).json({ error: 'Требуется вход' });
    return;
  }
  req.userId = uid;
  next();
}

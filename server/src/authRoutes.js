import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { isProduction, sendServerError } from './httpError.js';
import { sendTransactionalMail } from './mail.js';
import { resetPasswordFields, verifyEmailFields } from './mailTemplates.js';

function mail502Payload(mailErr) {
  const detail = String(mailErr?.message || mailErr);
  return {
    error: isProduction ? 'Не удалось отправить письмо' : `Не удалось отправить письмо: ${detail}`,
    code: 'MAIL_FAILED',
  };
}

const VERIFY_TTL_MS = 72 * 60 * 60 * 1000;
const RESET_TTL_MS = 48 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

function publicAppUrl() {
  const u = process.env.APP_PUBLIC_URL?.trim();
  if (u) return u.replace(/\/$/, '');
  return 'http://localhost:5174';
}

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function tokenBytes() {
  return randomBytes(32).toString('hex');
}

function hashToken(raw) {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function emailLooksValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeLoginKey(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

/** Логин без @: буквы, цифры, подчёркивание */
function loginFormatValid(s) {
  const t = normalizeLoginKey(s);
  return /^[a-z0-9_]{2,32}$/.test(t);
}

function badRequest(res, msg = 'Некорректные данные') {
  res.status(400).json({ error: msg });
}

const RegisterBody = z
  .object({
    email: z.string().trim().toLowerCase().max(200),
    password: z.string().min(8).max(200),
    login: z.string().trim().toLowerCase().max(32).optional(),
  })
  .strict();

const LoginBody = z
  .object({
    identifier: z.string().trim().min(1).max(200),
    password: z.string().min(1).max(200),
  })
  .strict();

const EmailOnlyBody = z
  .object({
    email: z.string().trim().toLowerCase().max(200),
  })
  .strict();

const ResetPasswordBody = z
  .object({
    token: z.string().trim().min(1).max(500),
    password: z.string().min(8).max(200),
  })
  .strict();

/**
 * Локальная часть email → логин [a-z0-9_]{2,32}; иначе null (слишком коротко или пусто после очистки).
 */
function deriveLoginFromEmailLocal(email) {
  const local = normalizeEmail(email).split('@')[0] ?? '';
  let t = local
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  if (t.length > 32) t = t.slice(0, 32).replace(/_+$/g, '');
  if (t.length < 2) return null;
  if (!loginFormatValid(t)) return null;
  return t;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} base
 */
async function allocateUniqueLogin(prisma, base) {
  const b = base.slice(0, 32);
  if (!loginFormatValid(b)) return null;
  let candidate = b;
  for (let i = 0; i < 100; i++) {
    const taken = await prisma.user.findFirst({ where: { login: candidate } });
    if (!taken) return candidate;
    const suffix = String(i + 1);
    const stemMax = 32 - suffix.length - 1;
    if (stemMax < 1) {
      candidate = `u_${tokenBytes().slice(0, 28)}`.slice(0, 32);
    } else {
      candidate = `${b.slice(0, Math.min(b.length, stemMax))}_${suffix}`;
    }
    if (!loginFormatValid(candidate)) {
      candidate = `u_${tokenBytes().slice(0, 28)}`.slice(0, 32);
    }
  }
  return null;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ ensureDefaultFieldsForUser: (userId: string) => Promise<void> }} hooks
 */
export function mountAuthRoutes(app, prisma, hooks) {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const forgotLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  /** Токен для заголовка X-CSRF-Token на мутациях (после ensureCsrfToken в index.js). */
  app.get('/api/auth/csrf', (req, res) => {
    res.json({ csrfToken: String(req.session?.csrfToken ?? '') });
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const uid = req.session?.userId;
      if (!uid) {
        res.json({ user: null });
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, email: true, login: true, emailVerifiedAt: true },
      });
      if (!user) {
        req.session.destroy(() => {});
        res.json({ user: null });
        return;
      }
      res.json({
        user: {
          id: user.id,
          email: user.email,
          login: user.login,
          emailVerified: Boolean(user.emailVerifiedAt),
        },
      });
    } catch (e) {
      sendServerError(res, e);
    }
  });

  app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
      const parsed = RegisterBody.safeParse(req.body);
      if (!parsed.success) {
        badRequest(res);
        return;
      }
      const email = normalizeEmail(parsed.data.email);
      const password = parsed.data.password;
      if (!emailLooksValid(email)) {
        res.status(400).json({ error: 'Некорректный email' });
        return;
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.emailVerifiedAt) {
        // Anti-enumeration: не раскрываем, есть ли аккаунт.
        res.json({ ok: true, message: 'Если email свободен, мы отправили ссылку для подтверждения.' });
        return;
      }
      if (existing && !existing.emailVerifiedAt) {
        // deleteMany: при гонке двух запросов второй delete() дал бы P2025 «record not found»
        await prisma.user.deleteMany({ where: { id: existing.id } });
      }

      const rawLogin = parsed.data.login;
      /** @type {string | null} */
      let loginToSet = null;
      if (rawLogin != null && String(rawLogin).trim() !== '') {
        if (!loginFormatValid(rawLogin)) {
          res.status(400).json({
            error: 'Логин: 2–32 символа (латиница, цифры, символ _)',
          });
          return;
        }
        loginToSet = normalizeLoginKey(rawLogin);
        const loginTaken = await prisma.user.findFirst({ where: { login: loginToSet } });
        if (loginTaken) {
          res.status(409).json({ error: 'Этот логин уже занят' });
          return;
        }
      } else {
        const derived = deriveLoginFromEmailLocal(email);
        if (derived) {
          loginToSet = await allocateUniqueLogin(prisma, derived);
        }
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await prisma.user.create({
        data: { email, passwordHash, ...(loginToSet ? { login: loginToSet } : {}) },
        select: { id: true, email: true },
      });

      const raw = tokenBytes();
      const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);
      await prisma.authToken.create({
        data: {
          userId: user.id,
          type: 'VERIFY_EMAIL',
          tokenHash: hashToken(raw),
          expiresAt,
        },
      });

      const link = `${publicAppUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
      try {
        await sendTransactionalMail({
          kind: 'verify_email',
          to: user.email,
          ...verifyEmailFields(link),
        });
      } catch (mailErr) {
        console.error('[mail] register', mailErr);
        res.status(502).json(mail502Payload(mailErr));
        return;
      }
      res.json({ ok: true, message: 'Проверьте почту для подтверждения' });
    } catch (e) {
      if (e.code === 'P2002') {
        res.status(409).json({ error: 'Повторите попытку' });
        return;
      }
      sendServerError(res, e);
    }
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) {
        badRequest(res);
        return;
      }
      const raw = parsed.data.identifier;
      const password = parsed.data.password;
      /** @type {import('@prisma/client').User | null} */
      let user = null;
      if (raw.includes('@')) {
        const email = normalizeEmail(raw);
        if (!emailLooksValid(email)) {
          res.status(400).json({ error: 'Некорректный email' });
          return;
        }
        user = await prisma.user.findUnique({ where: { email } });
      } else {
        if (!loginFormatValid(raw)) {
          res.status(400).json({
            error: 'Логин: 2–32 символа (латиница, цифры, _) или введите email',
          });
          return;
        }
        const login = normalizeLoginKey(raw);
        user = await prisma.user.findFirst({ where: { login } });
      }
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ error: 'Неверный логин, email или пароль' });
        return;
      }
      if (!user.emailVerifiedAt) {
        res.status(403).json({
          error: 'Сначала подтвердите email — проверьте почту или запросите письмо снова',
          code: 'VERIFY_EMAIL_REQUIRED',
        });
        return;
      }
      req.session.userId = user.id;
      res.json({
        user: {
          id: user.id,
          email: user.email,
          login: user.login,
          emailVerified: true,
        },
      });
    } catch (e) {
      sendServerError(res, e);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        sendServerError(res, err);
        return;
      }
      res.clearCookie('base56.sid', { path: '/' });
      res.json({ ok: true });
    });
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const raw = String(req.body?.token ?? req.query?.token ?? '').trim();
      if (!raw) {
        res.status(400).json({ error: 'token required' });
        return;
      }
      const tokenHash = hashToken(raw);
      const row = await prisma.authToken.findFirst({
        where: {
          type: 'VERIFY_EMAIL',
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });
      if (!row) {
        const used = await prisma.authToken.findFirst({
          where: { type: 'VERIFY_EMAIL', tokenHash, usedAt: { not: null } },
          include: { user: true },
        });
        if (used?.user?.emailVerifiedAt) {
          await hooks.ensureDefaultFieldsForUser(used.userId);
          res.json({ ok: true, already: true });
          return;
        }
        res.status(400).json({ error: 'Ссылка недействительна или устарела' });
        return;
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: row.userId },
          data: { emailVerifiedAt: new Date() },
        }),
        prisma.authToken.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        }),
      ]);

      await hooks.ensureDefaultFieldsForUser(row.userId);

      res.json({ ok: true });
    } catch (e) {
      sendServerError(res, e);
    }
  });

  app.post('/api/auth/forgot-password', forgotLimiter, async (req, res) => {
    try {
      const parsed = EmailOnlyBody.safeParse(req.body);
      if (!parsed.success) {
        res.json({ ok: true });
        return;
      }
      const email = normalizeEmail(parsed.data.email);
      if (!emailLooksValid(email)) {
        res.json({ ok: true });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.json({ ok: true });
        return;
      }

      await prisma.authToken.deleteMany({
        where: { userId: user.id, type: 'RESET_PASSWORD' },
      });
      const raw = tokenBytes();
      await prisma.authToken.create({
        data: {
          userId: user.id,
          type: 'RESET_PASSWORD',
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });

      const link = `${publicAppUrl()}/reset-password?token=${encodeURIComponent(raw)}`;
      try {
        await sendTransactionalMail({
          kind: 'reset_password',
          to: user.email,
          ...resetPasswordFields(link),
        });
      } catch (mailErr) {
        console.error('[mail] forgot', mailErr);
        res.status(502).json(mail502Payload(mailErr));
        return;
      }

      res.json({ ok: true });
    } catch (e) {
      if (!res.headersSent) {
        sendServerError(res, e);
      }
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const parsed = ResetPasswordBody.safeParse(req.body);
      if (!parsed.success) {
        badRequest(res);
        return;
      }
      const raw = parsed.data.token;
      const password = parsed.data.password;

      const tokenHash = hashToken(raw);
      const row = await prisma.authToken.findFirst({
        where: {
          type: 'RESET_PASSWORD',
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!row) {
        res.status(400).json({ error: 'Ссылка недействительна или устарела' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: row.userId },
          data: { passwordHash },
        }),
        prisma.authToken.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        }),
      ]);

      res.json({ ok: true });
    } catch (e) {
      sendServerError(res, e);
    }
  });

  app.post('/api/auth/resend-verification', forgotLimiter, async (req, res) => {
    try {
      const parsed = EmailOnlyBody.safeParse(req.body);
      if (!parsed.success) {
        res.json({ ok: true });
        return;
      }
      const email = normalizeEmail(parsed.data.email);
      if (!emailLooksValid(email)) {
        res.json({ ok: true });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.emailVerifiedAt) {
        res.json({ ok: true });
        return;
      }

      await prisma.authToken.deleteMany({
        where: { userId: user.id, type: 'VERIFY_EMAIL' },
      });
      const raw = tokenBytes();
      await prisma.authToken.create({
        data: {
          userId: user.id,
          type: 'VERIFY_EMAIL',
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        },
      });

      const link = `${publicAppUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
      try {
        await sendTransactionalMail({
          kind: 'verify_email',
          to: user.email,
          ...verifyEmailFields(link),
        });
      } catch (mailErr) {
        console.error('[mail] resend', mailErr);
        res.status(502).json(mail502Payload(mailErr));
        return;
      }

      res.json({ ok: true });
    } catch (e) {
      if (!res.headersSent) {
        sendServerError(res, e);
      }
    }
  });
}

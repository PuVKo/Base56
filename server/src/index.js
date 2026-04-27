import './earlyBoot.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { prisma } from './db.js';
import { handleAssistantChat } from './assistantOpenRouter.js';
import {
  parseBookingCreateBody,
  parseBookingUpdateBody,
  parseFieldCreateBody,
  parseFieldPatchBody,
  parseFieldReorderBody,
} from './apiSchemas.js';
import { mountAuthRoutes } from './authRoutes.js';
import { ensureCsrfToken, requireCsrfUnlessExempt } from './csrf.js';
import { isRusenderConfigured, isSmtpConfigured } from './mail.js';
import { sendServerError } from './httpError.js';
import { createSessionMiddleware, requireAuth } from './session.js';
import { normalizeClientUi } from './userClientUi.js';

const __filename = fileURLToPath(import.meta.url);
const serverSrcDir = path.dirname(__filename);
/** Сборка Vite из корня репозитория: ../dist относительно server/ */
const webDistPath = path.join(serverSrcDir, '..', '..', 'dist');
/**
 * В Timeweb Apps порт обычно передаётся через env PORT (часто 8080).
 * Если PORT не задан, по умолчанию слушаем 8080, чтобы healthcheck не висел.
 * Для локалки порт задаётся в server/.env (обычно 3001).
 */
const PORT = Number(process.env.PORT) || 8080;
/** В контейнере healthcheck идёт не на 127.0.0.1 — по умолчанию слушаем все интерфейсы. Локально: LISTEN_HOST=127.0.0.1 */
const LISTEN_HOST = (process.env.LISTEN_HOST ?? '').trim() || '0.0.0.0';

/** Локальная разработка + CORS_ORIGINS (через запятую) + APP_PUBLIC_URL (один origin). */
function resolveCorsOrigins() {
  const defaults = ['http://localhost:5174', 'http://127.0.0.1:5174'];
  const extraList = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const single = (process.env.APP_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  const fromPublic = single ? [single] : [];
  const allowLocal = (process.env.CORS_ALLOW_LOCALHOST ?? '').trim() !== '0';
  const base = allowLocal ? defaults : [];
  const merged = [...new Set([...base, ...extraList, ...fromPublic])];
  return merged;
}

const OPTION_COLORS = new Set(['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']);

const DEFAULT_OPTION_SETS = {
  status: {
    items: [
      { id: 'booked', label: 'Записан', color: 'blue' },
      { id: 'processing', label: 'Обрабатывается', color: 'pink' },
      { id: 'done', label: 'Завершен', color: 'green' },
    ],
  },
  tagIds: {
    items: [
      { id: 'photo', label: 'Фотография', color: 'purple' },
      { id: 'it', label: 'IT', color: 'gray' },
    ],
  },
  sourceId: {
    items: [
      { id: 'avito', label: 'Авито', color: 'green' },
      { id: 'limpo', label: 'Лимпо Клуб', color: 'brown' },
      { id: 'partner', label: 'Партнёр', color: 'orange' },
      { id: 'direct', label: 'Напрямую', color: 'gray' },
    ],
  },
};

const DEFAULT_FIELDS = [
  { key: 'title', label: 'Название', type: 'text', sortOrder: 0, system: false, visible: true, options: null },
  { key: 'date', label: 'Дата', type: 'date', sortOrder: 1, system: true, visible: true, options: null },
  { key: 'timeRange', label: 'Время', type: 'time', sortOrder: 2, system: false, visible: true, options: null },
  { key: 'amount', label: 'Сумма (₽)', type: 'number', sortOrder: 3, system: false, visible: true, options: null },
  { key: 'description', label: 'Описание', type: 'textarea', sortOrder: 4, system: false, visible: true, options: null },
  { key: 'clientName', label: 'Клиент', type: 'client', sortOrder: 5, system: false, visible: true, options: null },
  {
    key: 'status',
    label: 'Статус',
    type: 'status',
    sortOrder: 6,
    system: false,
    visible: true,
    options: DEFAULT_OPTION_SETS.status,
  },
  {
    key: 'tagIds',
    label: 'Тэги',
    type: 'tags',
    sortOrder: 7,
    system: false,
    visible: true,
    options: DEFAULT_OPTION_SETS.tagIds,
  },
  {
    key: 'sourceId',
    label: 'Источник',
    type: 'source',
    sortOrder: 8,
    system: false,
    visible: true,
    options: DEFAULT_OPTION_SETS.sourceId,
  },
  {
    key: 'comments',
    label: 'Комментарии',
    type: 'comments',
    sortOrder: 9,
    system: false,
    visible: true,
    options: null,
  },
];

function fieldSupportsOptions(type) {
  return type === 'select' || type === 'multiselect' || type === 'status' || type === 'tags' || type === 'source';
}

function normalizeOptionItem(it, i) {
  const id = typeof it.id === 'string' && it.id.trim() ? it.id.trim() : randomUUID();
  const label =
    typeof it.label === 'string' && it.label.trim() ? it.label.trim().slice(0, 200) : `Вариант ${i + 1}`;
  const color = OPTION_COLORS.has(it.color) ? it.color : 'gray';
  return { id, label, color };
}

/** @param {unknown} raw */
function normalizeOptionsPayload(raw) {
  if (raw === null) return { items: [] };
  if (typeof raw !== 'object' || raw === null) return null;
  const items = /** @type {{ items?: unknown }} */ (raw).items;
  if (!Array.isArray(items)) return null;
  if (items.length > 200) return null;
  return { items: items.map((it, i) => normalizeOptionItem(/** @type {any} */ (it), i)) };
}

function slugKey(label) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const suffix = `_${Date.now().toString(36)}`;
  return `field_${base || 'custom'}${suffix}`;
}

async function ensureDefaultFields(userId) {
  const n = await prisma.fieldDefinition.count({ where: { userId } });
  if (n > 0) return;
  for (const f of DEFAULT_FIELDS) {
    await prisma.fieldDefinition.create({ data: { ...f, userId } });
  }
}

/** @param {unknown} options */
function fieldOptionsEmpty(options) {
  if (options == null) return true;
  if (typeof options !== 'object') return true;
  const items = /** @type {{ items?: unknown }} */ (options).items;
  return !Array.isArray(items) || items.length === 0;
}

/** Поля из старых БД без JSON options — записываем дефолтные варианты (без ручного «Сохранить»). */
/**
 * Удаляет ключ поля из `data` всех заказов (чтобы не копить «мусор» после удаления свойства).
 * @param {string} fieldKey ключ из FieldDefinition (например field_xxx или title)
 */
async function stripFieldKeyFromAllBookings(fieldKey, userId) {
  if (!fieldKey || typeof fieldKey !== 'string') return;
  const rows = await prisma.booking.findMany({ where: { userId }, select: { id: true, data: true } });
  const updates = [];
  for (const row of rows) {
    const raw = row.data;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const d = /** @type {Record<string, unknown>} */ ({ ...raw });
    if (!Object.prototype.hasOwnProperty.call(d, fieldKey)) continue;
    delete d[fieldKey];
    updates.push(
      prisma.booking.update({
        where: { id: row.id },
        data: { data: d },
      }),
    );
  }
  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

async function backfillClientNameFieldType(userId) {
  const row = await prisma.fieldDefinition.findFirst({ where: { userId, key: 'clientName' } });
  if (!row || row.type !== 'text') return;
  await prisma.fieldDefinition.update({
    where: { id: row.id },
    data: { type: 'client', label: 'Клиент' },
  });
  console.log('Base56: поле clientName переведено на тип «Клиент» (имя + телефон)');
}

async function backfillLegacyFieldOptions(userId) {
  const rows = await prisma.fieldDefinition.findMany({
    where: { userId, key: { in: ['status', 'tagIds', 'sourceId'] } },
  });
  let n = 0;
  for (const row of rows) {
    if (!fieldOptionsEmpty(row.options)) continue;
    const next =
      row.key === 'status'
        ? DEFAULT_OPTION_SETS.status
        : row.key === 'tagIds'
          ? DEFAULT_OPTION_SETS.tagIds
          : row.key === 'sourceId'
            ? DEFAULT_OPTION_SETS.sourceId
            : null;
    if (!next) continue;
    await prisma.fieldDefinition.update({
      where: { id: row.id },
      data: { options: next },
    });
    n += 1;
  }
  if (n > 0) {
    console.log(`Base56: backfilled options for ${n} field(s) (status / tagIds / sourceId)`);
  }
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const corsOrigins = resolveCorsOrigins();
const isProd = process.env.NODE_ENV === 'production';
if (isProd && corsOrigins.length === 0) {
  console.warn(
    '[Base56] WARN: CORS origins пусты в production. Задайте APP_PUBLIC_URL и/или CORS_ORIGINS.',
  );
}

/** CSP: в production включено по умолчанию; локально — CSP_ENABLED=1. Отключить: CSP_ENABLED=0. */
function createHelmetMiddleware() {
  const raw = (process.env.CSP_ENABLED ?? '').trim().toLowerCase();
  const cspOn = raw === '1' || (raw !== '0' && process.env.NODE_ENV === 'production');
  if (!cspOn) {
    return helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    });
  }
  /** @type {Record<string, string[] | string[][]>} */
  const directives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    objectSrc: ["'none'"],
  };
  const pub = (process.env.APP_PUBLIC_URL ?? '').trim();
  if (pub.startsWith('https://')) {
    directives.upgradeInsecureRequests = [];
  }
  return helmet({
    contentSecurityPolicy: { directives },
    crossOriginEmbedderPolicy: false,
  });
}

app.use(createHelmetMiddleware());

app.use(
  cors({
    origin(origin, callback) {
      // same-origin / curl / server-to-server
      if (!origin) return callback(null, true);
      const o = String(origin).replace(/\/$/, '');
      if (corsOrigins.includes(o)) return callback(null, true);
      return callback(new Error('CORS: origin not allowed'), false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '20mb' }));

/** До session: иначе health проходит через connect-pg-simple и может зависнуть на БД → деплой без конца. */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(createSessionMiddleware());
app.use(ensureCsrfToken);
mountAuthRoutes(app, prisma, { ensureDefaultFieldsForUser: ensureDefaultFields });
app.use(requireCsrfUnlessExempt);

const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/assistant/chat', assistantLimiter, requireAuth, async (req, res) => {
  try {
    await handleAssistantChat(prisma, req, res);
  } catch (e) {
    if (!res.headersSent) {
      sendServerError(res, e);
    }
  }
});

app.get('/api/fields', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.fieldDefinition.findMany({
      where: { userId: req.userId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(rows);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.post('/api/fields', requireAuth, async (req, res) => {
  try {
    const parsed = parseFieldCreateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { label, type, visible = true, iconKey, options: optionsBody } = parsed.data;
    let options = null;
    if (type === 'select' || type === 'multiselect') {
      const n = normalizeOptionsPayload(optionsBody);
      if (n && n.items.length > 0) {
        options = n;
      } else {
        options = {
          items: [{ id: randomUUID(), label: 'Вариант 1', color: 'gray' }],
        };
      }
    }
    const maxOrder = await prisma.fieldDefinition.aggregate({
      where: { userId: req.userId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const key = slugKey(label);
    const row = await prisma.fieldDefinition.create({
      data: {
        userId: req.userId,
        key,
        label: label.trim(),
        type,
        sortOrder,
        system: false,
        visible: Boolean(visible),
        iconKey: typeof iconKey === 'string' && iconKey.trim() ? iconKey.trim() : null,
        options,
      },
    });
    res.json(row);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.patch('/api/fields/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = parseFieldPatchBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { label, visible, sortOrder, iconKey, options: optionsBody } = parsed.data;
    const existing = await prisma.fieldDefinition.findFirst({ where: { id, userId: req.userId } });
    if (!existing) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const data = {};
    if (typeof label === 'string') data.label = label.trim();
    if (typeof visible === 'boolean') data.visible = visible;
    if (typeof sortOrder === 'number' && Number.isFinite(sortOrder)) data.sortOrder = sortOrder;
    if (iconKey !== undefined) {
      if (iconKey === null || iconKey === '') data.iconKey = null;
      else if (typeof iconKey === 'string') data.iconKey = iconKey.trim() || null;
      else {
        res.status(400).json({ error: 'invalid iconKey' });
        return;
      }
    }
    if (optionsBody !== undefined) {
      if (!fieldSupportsOptions(existing.type)) {
        res.status(400).json({ error: 'field type does not support options' });
        return;
      }
      const n = normalizeOptionsPayload(optionsBody);
      if (n === null) {
        res.status(400).json({ error: 'invalid options' });
        return;
      }
      if (n.items.length === 0) {
        res.status(400).json({ error: 'at least one option required' });
        return;
      }
      data.options = n;
    }
    const row = await prisma.fieldDefinition.update({ where: { id }, data });
    res.json(row);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.delete('/api/fields/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.fieldDefinition.findFirst({ where: { id, userId: req.userId } });
    if (!existing) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    if (existing.system) {
      res.status(403).json({ error: 'system field cannot be deleted' });
      return;
    }
    await stripFieldKeyFromAllBookings(existing.key, req.userId);
    await prisma.fieldDefinition.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.put('/api/fields/reorder', requireAuth, async (req, res) => {
  try {
    const parsed = parseFieldReorderBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { ids } = parsed.data;
    const owned = await prisma.fieldDefinition.count({
      where: { userId: req.userId, id: { in: ids } },
    });
    if (owned !== ids.length) {
      res.status(400).json({ error: 'invalid field ids' });
      return;
    }
    await prisma.$transaction(
      ids.map((fieldId, i) =>
        prisma.fieldDefinition.update({
          where: { id: fieldId },
          data: { sortOrder: i },
        }),
      ),
    );
    const rows = await prisma.fieldDefinition.findMany({
      where: { userId: req.userId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(rows);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.booking.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    const list = rows.map((r) => {
      const d = typeof r.data === 'object' && r.data !== null ? r.data : {};
      return { ...d, id: r.id, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
    });
    res.json(list);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.get('/api/user/ui-prefs', requireAuth, async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { uiPrefs: true },
    });
    const raw = u?.uiPrefs;
    const persisted = raw != null && typeof raw === 'object';
    const clientUi = normalizeClientUi(persisted ? raw : undefined);
    res.json({ clientUi, persisted });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.put('/api/user/ui-prefs', requireAuth, async (req, res) => {
  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const clientUi = normalizeClientUi(body);
    await prisma.user.update({
      where: { id: req.userId },
      data: { uiPrefs: clientUi },
    });
    res.json(clientUi);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
    const parsed = parseBookingCreateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const b = parsed.data;
    const { id, createdAt, updatedAt, ...rest } = b;
    if (rest.date != null && typeof rest.date === 'string') {
      rest.date = rest.date.trim();
    }
    const data = {};
    if (createdAt) data.createdAt = new Date(createdAt);
    if (updatedAt) data.updatedAt = new Date(updatedAt);
    const row = await prisma.booking.create({
      data: {
        id,
        userId: req.userId,
        data: rest,
        ...data,
      },
    });
    const d = typeof row.data === 'object' && row.data !== null ? row.data : {};
    res.json({ ...d, id: row.id, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch (e) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: 'already exists' });
      return;
    }
    sendServerError(res, e);
  }
});

app.put('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = parseBookingUpdateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const b = parsed.data;
    const { id: _i, createdAt, updatedAt, ...rest } = b;
    const hit = await prisma.booking.findFirst({ where: { id, userId: req.userId } });
    if (!hit) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const row = await prisma.booking.update({
      where: { id },
      data: {
        data: rest,
        updatedAt: new Date(),
      },
    });
    const d = typeof row.data === 'object' && row.data !== null ? row.data : {};
    res.json({ ...d, id: row.id, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.delete('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const hit = await prisma.booking.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!hit) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    await prisma.booking.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'P2025') {
      res.status(404).json({ error: 'not found' });
      return;
    }
    sendServerError(res, e);
  }
});

/** Удаляет все заказы текущего пользователя (определения полей не меняет). */
app.post('/api/bookings/clear', requireAuth, async (req, res) => {
  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    if (body.confirm !== true) {
      res.status(400).json({ error: 'В теле запроса укажите { "confirm": true }' });
      return;
    }
    const r = await prisma.booking.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true, deleted: r.count });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.post('/api/bookings/migrate', requireAuth, async (req, res) => {
  try {
    const { bookings } = req.body;
    if (!Array.isArray(bookings)) {
      res.status(400).json({ error: 'bookings array required' });
      return;
    }
    const existing = await prisma.booking.count({ where: { userId: req.userId } });
    if (existing > 0) {
      res.status(400).json({ error: 'database already has bookings' });
      return;
    }
    for (const b of bookings) {
      if (!b?.id) continue;
      const { id, createdAt, updatedAt, ...rest } = b;
      const data = {};
      if (createdAt) data.createdAt = new Date(createdAt);
      if (updatedAt) data.updatedAt = new Date(updatedAt);
      await prisma.booking.create({
        data: {
          id,
          userId: req.userId,
          data: rest,
          ...data,
        },
      });
    }
    const rows = await prisma.booking.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    const list = rows.map((r) => {
      const d = typeof r.data === 'object' && r.data !== null ? r.data : {};
      return { ...d, id: r.id, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
    });
    res.json({ count: list.length, bookings: list });
  } catch (e) {
    sendServerError(res, e);
  }
});

/** Раньше выполнялось до listen — при недоступной БД первый запрос к Postgres зависал и порт не открывался (деплой без /api/health). */
async function runStartupBackfills() {
  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      await ensureDefaultFields(u.id);
      await backfillClientNameFieldType(u.id);
      await backfillLegacyFieldOptions(u.id);
    }
  } catch (e) {
    console.error('Base56: startup backfill failed', e);
  }
}

async function main() {
  const mailMode = (process.env.MAIL_MODE ?? '').trim().toLowerCase();
  if (mailMode === 'console' || mailMode === 'log') {
    console.log('Почта: MAIL_MODE=console — отправка отключена, только лог [mail]');
  } else if (isRusenderConfigured()) {
    console.log('Почта: RuSender (Email API)');
  } else if (isSmtpConfigured()) {
    const host = process.env.SMTP_HOST?.trim() ?? '';
    console.log(`Почта: SMTP (${host})`);
  } else {
    console.log(
      'Почта: не настроена — задайте RUSENDER_API_KEY + MAIL_FROM или SMTP в server/.env (см. .env.example)',
    );
  }

  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        name: 'Base56 API',
        health: '/api/health',
        hint: 'Нет ../dist: на деплое запускайте сборку фронта из корня репо (см. scripts/build-server.sh).',
      });
    });
  }

  const server = app.listen(PORT, LISTEN_HOST, () => {
    console.log(
      `Base56 listen PORT=${PORT} host=${LISTEN_HOST} (env PORT=${process.env.PORT ?? ''}, NODE_ENV=${process.env.NODE_ENV ?? ''})`,
    );
    console.log(
      `Base56 http://localhost:${PORT}${fs.existsSync(webDistPath) ? ' (API + статика)' : ' (только API)'}`,
    );
    void runStartupBackfills();
  });
  server.on('error', (err) => {
    console.error('[Base56] listen error', err);
    process.exit(1);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import { prisma } from './db.js';
import { mountAuthRoutes } from './authRoutes.js';
import { isRusenderConfigured, isSmtpConfigured } from './mail.js';
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
const ADMIN_RESET_SECRET = process.env.ADMIN_RESET_SECRET?.trim();

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

const ADDABLE_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'email',
  'phone',
  'client',
  'url',
  'checkbox',
  'select',
  'multiselect',
]);

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
app.use(cors({ origin: ['http://localhost:5174', 'http://127.0.0.1:5174'], credentials: true }));
app.use(express.json({ limit: '20mb' }));

/** До session: иначе health проходит через connect-pg-simple и может зависнуть на БД → деплой без конца. */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// До createSessionMiddleware: в production без SESSION_SECRET ≥16 символов будет throw — в логах не будет «Base56 listen».
console.log(
  `[Base56] boot cwd=${process.cwd()} NODE_ENV=${process.env.NODE_ENV ?? ''} sessionSecretOk=${(process.env.SESSION_SECRET?.trim()?.length ?? 0) >= 16}`,
);
app.use(createSessionMiddleware());
mountAuthRoutes(app, prisma, { ensureDefaultFieldsForUser: ensureDefaultFields });

app.get('/api/fields', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.fieldDefinition.findMany({
      where: { userId: req.userId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.post('/api/fields', requireAuth, async (req, res) => {
  try {
    const { label, type, visible = true, iconKey, options: optionsBody } = req.body;
    if (!label || typeof label !== 'string') {
      res.status(400).json({ error: 'label required' });
      return;
    }
    if (!ADDABLE_FIELD_TYPES.has(type)) {
      res.status(400).json({ error: 'invalid type' });
      return;
    }
    if (iconKey !== undefined && iconKey !== null && typeof iconKey !== 'string') {
      res.status(400).json({ error: 'invalid iconKey' });
      return;
    }
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.patch('/api/fields/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, visible, sortOrder, iconKey, options: optionsBody } = req.body;
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.put('/api/fields/reorder', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids array required' });
      return;
    }
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
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
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
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
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
    const b = req.body;
    if (!b?.id) {
      res.status(400).json({ error: 'id required' });
      return;
    }
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

app.put('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
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
    res.status(404).json({ error: 'not found' });
  }
});

/** Удаляет все заказы текущего пользователя (поля не трогает). При ADMIN_RESET_SECRET нужен заголовок X-Admin-Reset-Secret. */
app.post('/api/admin/reset-bookings', requireAuth, async (req, res) => {
  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    if (body.confirm !== true) {
      res.status(400).json({ error: 'В теле запроса укажите { "confirm": true }' });
      return;
    }
    if (ADMIN_RESET_SECRET) {
      const h = String(req.headers['x-admin-reset-secret'] ?? '');
      if (h !== ADMIN_RESET_SECRET) {
        res.status(403).json({ error: 'Неверный секрет сброса' });
        return;
      }
    }
    const r = await prisma.booking.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true, deleted: r.count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

function ymdYear(ymd) {
  const s = String(ymd ?? '').trim();
  const m = s.match(/^(\d{4})-\d{2}-\d{2}$/);
  return m ? Number(m[1]) : NaN;
}

app.get('/api/admin/export-dump', requireAuth, async (req, res) => {
  try {
    const qYear = req.query?.year != null ? Number(req.query.year) : NaN;
    const year = Number.isFinite(qYear) ? qYear : NaN;

    const fields = await prisma.fieldDefinition.findMany({
      where: { userId: req.userId },
      orderBy: { sortOrder: 'asc' },
    });
    const bookingRows = await prisma.booking.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    const bookings = bookingRows
      .map((r) => {
        const d = typeof r.data === 'object' && r.data !== null ? r.data : {};
        return { ...d, id: r.id, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
      })
      .filter((b) => {
        if (!Number.isFinite(year)) return true;
        return ymdYear(b.date) === year;
      });

    const urow = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { uiPrefs: true },
    });
    const clientUi = normalizeClientUi(
      urow?.uiPrefs != null && typeof urow.uiPrefs === 'object' ? urow.uiPrefs : undefined,
    );

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="base56_dump${Number.isFinite(year) ? `_${year}` : ''}.json"`,
    );
    res.end(
      JSON.stringify({
        ok: true,
        year: Number.isFinite(year) ? year : null,
        fields,
        bookings,
        clientUi,
      }),
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/admin/import-dump', requireAuth, async (req, res) => {
  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const { fields, bookings, overwrite, clientUi: clientUiBody } = body;
    if (!Array.isArray(fields) || !Array.isArray(bookings)) {
      res.status(400).json({ error: 'fields and bookings arrays required' });
      return;
    }

    const uid = req.userId;
    const existing = await prisma.booking.count({ where: { userId: uid } });
    if (existing > 0 && overwrite !== true) {
      res.status(400).json({ error: 'database already has bookings (pass overwrite=true to replace)' });
      return;
    }

    if (overwrite === true) {
      await prisma.booking.deleteMany({ where: { userId: uid } });
      await prisma.fieldDefinition.deleteMany({ where: { userId: uid } });
    }

    /** Все занятые PK — иначе два поля в дампе с одним id дают P2002 на `id`. */
    const takenFieldIds = new Set(
      (await prisma.fieldDefinition.findMany({ select: { id: true } })).map((r) => r.id),
    );

    // Fields: create in given order; keep ids if свободны (cuid из экспорта).
    for (const f of fields) {
      if (!f || typeof f !== 'object') continue;
      const { id, key, label, type, sortOrder, system, visible, options, iconKey } = f;
      if (!key || !label || !type) continue;
      const k = String(key);
      const wantId = id && typeof id === 'string' && id.trim() ? id.trim() : '';
      const useCustomId = Boolean(wantId && !takenFieldIds.has(wantId));

      const row = await prisma.fieldDefinition.upsert({
        where: { userId_key: { userId: uid, key: k } },
        update: {
          label: String(label),
          type: String(type),
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          system: Boolean(system),
          visible: visible !== undefined ? Boolean(visible) : true,
          options: options ?? null,
          iconKey: iconKey !== undefined ? (iconKey === null || iconKey === '' ? null : String(iconKey)) : undefined,
        },
        create: {
          ...(useCustomId ? { id: wantId } : {}),
          userId: uid,
          key: k,
          label: String(label),
          type: String(type),
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          system: Boolean(system),
          visible: visible !== undefined ? Boolean(visible) : true,
          options: options ?? null,
          iconKey:
            iconKey !== undefined && iconKey !== null && String(iconKey).trim()
              ? String(iconKey).trim()
              : null,
        },
      });
      takenFieldIds.add(row.id);
    }

    // Bookings: как /api/bookings/migrate; если нет id — новый uuid (старые дампы / ручное редактирование).
    // Если id занят у другого пользователя — импортируем с новым id (дамп не обязан быть "для того же userId").
    let created = 0;
    let bookingIdsGenerated = 0;
    let bookingIdsReplacedDueToConflict = 0;
    for (const b of bookings) {
      if (!b || typeof b !== 'object') continue;
      const { id: bodyId, createdAt, updatedAt, ...rest } = b;
      const rawId = bodyId != null ? String(bodyId).trim() : '';
      let id = rawId || randomUUID();
      if (!rawId) bookingIdsGenerated += 1;
      const meta = {};
      if (createdAt) meta.createdAt = new Date(createdAt);
      if (updatedAt) meta.updatedAt = new Date(updatedAt);
      const exB = await prisma.booking.findUnique({ where: { id } });
      if (exB && exB.userId !== uid) {
        let guard = 0;
        do {
          id = randomUUID();
          guard += 1;
        } while (guard < 8 && (await prisma.booking.findUnique({ where: { id } })));
        bookingIdsReplacedDueToConflict += 1;
      }
      await prisma.booking.upsert({
        where: { id },
        update: { data: rest, updatedAt: new Date() },
        create: { id, userId: uid, data: rest, ...meta },
      });
      created += 1;
    }

    if (clientUiBody != null && typeof clientUiBody === 'object') {
      await prisma.user.update({
        where: { id: uid },
        data: { uiPrefs: normalizeClientUi(clientUiBody) },
      });
    }

    res.json({
      ok: true,
      fields: fields.length,
      bookings: created,
      bookingsInPayload: bookings.length,
      bookingIdsGenerated,
      bookingIdsReplacedDueToConflict,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
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
    console.error(e);
    res.status(500).json({ error: String(e.message) });
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

  const serverIndexShim = path.join(serverSrcDir, '..', 'index.js');
  // #region agent log
  fetch('http://127.0.0.1:7387/ingest/791f3908-02e5-49cf-82aa-0b390ff7207b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b98ec6' },
    body: JSON.stringify({
      sessionId: 'b98ec6',
      runId: process.env.DEBUG_RUN_ID ?? 'pre-listen',
      hypothesisId: 'H1',
      location: 'server/src/index.js:before-listen',
      message: 'startup context (deploy path / PM2 cwd)',
      data: {
        port: PORT,
        cwd: process.cwd(),
        argv0: process.argv[0],
        argv1: process.argv[1],
        webDistExists: fs.existsSync(webDistPath),
        serverIndexShimExists: fs.existsSync(serverIndexShim),
        pmId: process.env.pm_id ?? null,
        nodeAppInstance: process.env.NODE_APP_INSTANCE ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  app.listen(PORT, LISTEN_HOST, () => {
    console.log(
      `Base56 listen PORT=${PORT} host=${LISTEN_HOST} (env PORT=${process.env.PORT ?? ''}, NODE_ENV=${process.env.NODE_ENV ?? ''})`,
    );
    console.log(
      `Base56 http://localhost:${PORT}${fs.existsSync(webDistPath) ? ' (API + статика)' : ' (только API)'}`,
    );
    void runStartupBackfills();
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { randomUUID } from 'node:crypto';

/**
 * Роутер бесплатных моделей OpenRouter с фильтром по фичам запроса (в т.ч. tool calling).
 * Переопределение: ASSISTANT_MODEL в server/.env (например openai/gpt-4o-mini после пополнения кредитов).
 * @see https://openrouter.ai/docs/guides/routing/routers/free-models-router
 */
const DEFAULT_MODEL = 'openrouter/free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_CREDITS_URL = 'https://openrouter.ai/settings/credits';

const MAX_TOOL_ROUNDS = 5;
const MAX_CLIENT_MESSAGES = 40;
const LIST_FETCH_CAP = 200;

/** @param {string} tz */
function isValidIanaTimeZone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 120) return false;
  try {
    Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Приоритет: IANA из запроса клиента (браузер) → ASSISTANT_TIMEZONE → Europe/Moscow.
 * @param {unknown} clientRaw
 */
function resolveAssistantTimeZone(clientRaw) {
  const fromClient = typeof clientRaw === 'string' ? clientRaw.trim() : '';
  if (fromClient && isValidIanaTimeZone(fromClient)) return fromClient;
  const fromEnv = (process.env.ASSISTANT_TIMEZONE ?? '').trim();
  if (fromEnv && isValidIanaTimeZone(fromEnv)) return fromEnv;
  return 'Europe/Moscow';
}

/** Чтобы модель не «жила» в 2024 из обучения и знала локальное «сейчас» пользователя. */
function buildClockContextBlock(tz) {
  const now = new Date();
  const iso = now.toISOString();
  let yearInTz = String(now.getUTCFullYear());
  let localHuman = iso;
  try {
    yearInTz = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric' }).format(now);
    localHuman = now.toLocaleString('ru-RU', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    // не должно случиться при валидированном tz
  }
  return [
    'Актуальные дата и время (всегда опирайся на этот блок, а не на «текущую дату» из данных обучения):',
    `- UTC: ${iso}`,
    `- По часовому поясу пользователя (${tz}, из настроек браузера/устройства): ${localHuman}; год: ${yearInTz}.`,
  ].join('\n');
}

/** Ограничение длины ответа (быстрее и дешевле; на tool-раундах тоже действует). */
function resolveMaxOutputTokens() {
  const raw = Number((process.env.ASSISTANT_MAX_OUTPUT_TOKENS ?? '1536').trim());
  if (!Number.isFinite(raw)) return 1536;
  return Math.min(8192, Math.max(256, Math.floor(raw)));
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_bookings',
      description:
        'Список записей пользователя (последние по обновлению). Фильтры опциональны: дата в поле date формата YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Максимум записей (1–50), по умолчанию 20' },
          dateFrom: { type: 'string', description: 'Включительно, YYYY-MM-DD' },
          dateTo: { type: 'string', description: 'Включительно, YYYY-MM-DD' },
          query: { type: 'string', description: 'Подстрока поиска по текстовым полям записи' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking',
      description: 'Одна запись по id (cuid).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Идентификатор записи' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description:
        'Создать запись. id генерируется автоматически. Передай поля согласно схеме (date YYYY-MM-DD и т.д.). Поля типа «Клиент» (персональные данные) через ассистента недоступны.',
      parameters: {
        type: 'object',
        properties: {
          fields: {
            type: 'object',
            description: 'Пары ключ-значение полей записи (без id). Без полей типа «Клиент».',
          },
        },
        required: ['fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_booking',
      description:
        'Обновить поля записи по id (частичное слияние с существующими данными). Поля типа «Клиент» через ассистента недоступны.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fields: { type: 'object', description: 'Только изменяемые поля (без полей типа «Клиент»).' },
        },
        required: ['id', 'fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_booking',
      description: 'Удалить запись по id. Используй только по явной просьбе пользователя.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
];

/**
 * Ключи полей для ассистента: без типа `client` (персональные данные в модель не отправляются).
 * @returns {{ writableKeys: Set<string>, redactedKeys: Set<string> }}
 */
async function loadAssistantFieldKeySets(prisma, userId) {
  const rows = await prisma.fieldDefinition.findMany({
    where: { userId },
    select: { key: true, type: true },
  });
  const writableKeys = new Set();
  const redactedKeys = new Set();
  for (const r of rows) {
    if (r.type === 'client') redactedKeys.add(r.key);
    else writableKeys.add(r.key);
  }
  return { writableKeys, redactedKeys };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} userId
 */
async function buildFieldsSummary(prisma, userId) {
  const rows = await prisma.fieldDefinition.findMany({
    where: { userId, type: { not: 'client' } },
    orderBy: { sortOrder: 'asc' },
    select: { key: true, label: true, type: true },
  });
  if (rows.length === 0) {
    const clientFields = await prisma.fieldDefinition.count({ where: { userId, type: 'client' } });
    if (clientFields > 0) {
      return '(только поле «Клиент» — в модель не входит; добавьте другие поля в настройках)';
    }
    return '(поля не настроены)';
  }
  return rows.map((r) => `${r.key} (${r.label}, тип ${r.type})`).join('; ');
}

/**
 * Убирает из объекта записи ключи персональных полей перед отправкой в LLM.
 * @param {Record<string, unknown>} bookingLike
 * @param {Set<string>} redactedKeys
 */
function sanitizeBookingForLlm(bookingLike, redactedKeys) {
  const out = { ...bookingLike };
  for (const k of redactedKeys) delete out[k];
  return out;
}

/** @param {import('@prisma/client').Booking} row */
function rowToApi(row) {
  const d = typeof row.data === 'object' && row.data !== null ? row.data : {};
  return {
    ...d,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** @param {string} ymd */
function isYmd(ymd) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd ?? '').trim());
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} q
 */
function rowMatchesQuery(data, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  for (const v of Object.values(data)) {
    if (v == null) continue;
    if (typeof v === 'string' && v.toLowerCase().includes(needle)) return true;
    if (typeof v === 'number' && String(v).includes(needle)) return true;
  }
  return false;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} userId
 * @param {Set<string>} writableKeys — без полей типа client
 * @param {Set<string>} redactedKeys — ключи client, вырезаются из ответов инструментов
 * @param {string} name
 * @param {unknown} rawArgs
 */
async function executeTool(prisma, userId, writableKeys, redactedKeys, name, rawArgs) {
  let args = /** @type {Record<string, unknown>} */ ({});
  if (typeof rawArgs === 'string') {
    try {
      args = JSON.parse(rawArgs || '{}');
    } catch {
      return { ok: false, error: 'invalid_tool_arguments_json' };
    }
  } else if (rawArgs && typeof rawArgs === 'object') {
    args = /** @type {Record<string, unknown>} */ (rawArgs);
  }

  if (name === 'list_bookings') {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    const dateFrom = typeof args.dateFrom === 'string' ? args.dateFrom.trim() : '';
    const dateTo = typeof args.dateTo === 'string' ? args.dateTo.trim() : '';
    const query = typeof args.query === 'string' ? args.query : '';
    const rows = await prisma.booking.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: LIST_FETCH_CAP,
    });
    const out = [];
    for (const row of rows) {
      const api = rowToApi(row);
      const dateVal = typeof api.date === 'string' ? api.date : '';
      if (dateFrom && isYmd(dateFrom) && dateVal && dateVal < dateFrom) continue;
      if (dateTo && isYmd(dateTo) && dateVal && dateVal > dateTo) continue;
      const dataOnly = { ...api };
      delete dataOnly.id;
      delete dataOnly.createdAt;
      delete dataOnly.updatedAt;
      for (const k of redactedKeys) delete dataOnly[k];
      if (!rowMatchesQuery(dataOnly, query)) continue;
      out.push(sanitizeBookingForLlm(api, redactedKeys));
      if (out.length >= limit) break;
    }
    return { ok: true, bookings: out, count: out.length };
  }

  if (name === 'get_booking') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    if (!id) return { ok: false, error: 'id required' };
    const row = await prisma.booking.findFirst({ where: { id, userId } });
    if (!row) return { ok: false, error: 'not_found' };
    return { ok: true, booking: sanitizeBookingForLlm(rowToApi(row), redactedKeys) };
  }

  if (name === 'create_booking') {
    const fields = args.fields && typeof args.fields === 'object' && !Array.isArray(args.fields) ? args.fields : null;
    if (!fields) return { ok: false, error: 'fields object required' };
    const id = randomUUID();
    const data = {};
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
      if (writableKeys.has(k)) data[k] = v;
    }
    if (data.date != null && typeof data.date === 'string') data.date = data.date.trim();
    try {
      const row = await prisma.booking.create({
        data: { id, userId, data },
      });
      return { ok: true, booking: sanitizeBookingForLlm(rowToApi(row), redactedKeys) };
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? e.code : '';
      return { ok: false, error: String(e?.message || e), code: String(code) };
    }
  }

  if (name === 'update_booking') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    const fields =
      args.fields && typeof args.fields === 'object' && !Array.isArray(args.fields) ? args.fields : null;
    if (!id || !fields) return { ok: false, error: 'id and fields required' };
    const hit = await prisma.booking.findFirst({ where: { id, userId } });
    if (!hit) return { ok: false, error: 'not_found' };
    const raw = hit.data;
    const base = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? { ...raw } : {};
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
      if (writableKeys.has(k)) base[k] = v;
    }
    if (base.date != null && typeof base.date === 'string') base.date = base.date.trim();
    const row = await prisma.booking.update({
      where: { id },
      data: { data: base, updatedAt: new Date() },
    });
    return { ok: true, booking: sanitizeBookingForLlm(rowToApi(row), redactedKeys) };
  }

  if (name === 'delete_booking') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    if (!id) return { ok: false, error: 'id required' };
    const hit = await prisma.booking.findFirst({ where: { id, userId } });
    if (!hit) return { ok: false, error: 'not_found' };
    await prisma.booking.delete({ where: { id } });
    return { ok: true, deletedId: id };
  }

  return { ok: false, error: `unknown_tool:${name}` };
}

/**
 * @param {unknown} msg
 * @returns {{ role: string; content: string } | null}
 */
function normalizeClientMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const role = String(msg.role ?? '').trim();
  if (role !== 'user' && role !== 'assistant') return null;
  const content =
    typeof msg.content === 'string'
      ? msg.content
      : msg.content != null
        ? JSON.stringify(msg.content)
        : '';
  if (role === 'user' && !content.trim()) return null;
  return { role, content: content.slice(0, 24_000) };
}

/**
 * @param {string} raw
 * @param {number} httpStatus
 */
function formatOpenRouterClientError(raw, httpStatus) {
  const s = String(raw ?? '');
  if (/insufficient credits|never purchased credits/i.test(s)) {
    return {
      status: 402,
      message: `На аккаунте OpenRouter нет кредитов (или ключ привязан к другому аккаунту). Пополните баланс: ${OPENROUTER_CREDITS_URL}`,
    };
  }
  if (httpStatus === 429) return { status: 429, message: s };
  return { status: 502, message: s };
}

/**
 * @param {unknown} tc
 * @returns {{ id: string; name: string; arguments: string } | null}
 */
function parseToolCall(tc) {
  if (!tc || typeof tc !== 'object') return null;
  const id = /** @type {{ id?: unknown }} */ (tc).id;
  const fn = /** @type {{ function?: unknown }} */ (tc).function;
  if (typeof id !== 'string' || !id) return null;
  if (!fn || typeof fn !== 'object') return null;
  const name = /** @type {{ name?: unknown }} */ (fn).name;
  const args = /** @type {{ arguments?: unknown }} */ (fn).arguments;
  if (typeof name !== 'string' || !name) return null;
  const argumentsStr = typeof args === 'string' ? args : JSON.stringify(args ?? {});
  return { id, name, arguments: argumentsStr };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleAssistantChat(prisma, req, res) {
  if (String(process.env.ASSISTANT_DISABLED ?? '').trim() === '1') {
    res.status(503).json({ error: 'Ассистент отключён (ASSISTANT_DISABLED=1).' });
    return;
  }
  const apiKey = (process.env.OPENROUTER_API_KEY ?? '').trim();
  if (!apiKey) {
    res.status(503).json({
      error:
        'Не задан OPENROUTER_API_KEY в server/.env (ключ: https://openrouter.ai/keys). Модель: ASSISTANT_MODEL.',
    });
    return;
  }

  const userId = req.userId;
  if (!userId || typeof userId !== 'string') {
    res.status(401).json({ error: 'Требуется вход' });
    return;
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const rawMessages = Array.isArray(body.messages) ? body.messages : null;
  if (!rawMessages) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  const trimmed = [];
  for (const m of rawMessages.slice(-MAX_CLIENT_MESSAGES)) {
    const n = normalizeClientMessage(m);
    if (n) trimmed.push(n);
  }
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
    res.status(400).json({ error: 'Последнее сообщение должно быть от пользователя (role: user).' });
    return;
  }

  const modelId = (process.env.ASSISTANT_MODEL ?? '').trim() || DEFAULT_MODEL;
  const assistantTz = resolveAssistantTimeZone(body.timezone ?? body.timeZone);
  const { writableKeys, redactedKeys } = await loadAssistantFieldKeySets(prisma, userId);
  const fieldsSummary = await buildFieldsSummary(prisma, userId);

  const systemContent = [
    buildClockContextBlock(assistantTz),
    '',
    'Ты помощник в приложении Base56: записи клиентов (брони) с настраиваемыми полями.',
    'Персональное поле «Клиент» (тип client в БД) никогда не передаётся в модель и недоступно инструментам; не проси ФИО/телефон для записи в чат — пользователь заполняет это в интерфейсе.',
    'Поле даты записи: ключ date, формат YYYY-MM-DD.',
    `Доступные ключи полей пользователя: ${fieldsSummary}`,
    'Вызывай инструменты для чтения и изменения данных; не выдумывай id записей — получай их из list_bookings или get_booking.',
    'Удаляй записи (delete_booking) только если пользователь явно попросил удалить.',
    'Отвечай по-русски, кратко, по существу. Не расписывай длинные рассуждения — по возможности сразу инструменты или короткий ответ.',
  ].join('\n');

  /** @type {Record<string, string>[]} */
  const messages = [{ role: 'system', content: systemContent }];
  for (const m of trimmed) {
    messages.push({ role: m.role, content: m.content });
  }

  const referer = (process.env.OPENROUTER_HTTP_REFERER ?? process.env.APP_PUBLIC_URL ?? '').trim() || 'http://localhost';
  const title = (process.env.OPENROUTER_APP_TITLE ?? 'Base56').trim() || 'Base56';

  let lastModel = modelId;
  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    let orRes;
    try {
      orRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer,
          'X-Title': title,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.25,
          max_tokens: resolveMaxOutputTokens(),
        }),
      });
    } catch (err) {
      console.error('[assistant] fetch openrouter', err);
      res.status(502).json({ error: `Сеть: не удалось связаться с OpenRouter (${String(err?.message || err)})` });
      return;
    }

    const rawText = await orRes.text();
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      res.status(502).json({ error: 'OpenRouter вернул не-JSON.' });
      return;
    }

    if (!orRes.ok) {
      const errMsg =
        data?.error?.message ||
        data?.error ||
        rawText.slice(0, 500) ||
        orRes.statusText;
      const { status, message } = formatOpenRouterClientError(String(errMsg), orRes.status);
      res.status(status).json({ error: message });
      return;
    }

    const choice = data.choices && data.choices[0];
    const msg = choice?.message;
    if (!msg || typeof msg !== 'object') {
      res.status(502).json({ error: 'Пустой ответ модели (нет choices[0].message).' });
      return;
    }

    if (typeof data.model === 'string' && data.model) lastModel = data.model;

    const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

    if (toolCalls.length === 0) {
      const text =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content != null
            ? JSON.stringify(msg.content)
            : '';
      res.json({
        message: { role: 'assistant', content: text.trim() },
        model: lastModel,
      });
      return;
    }

    messages.push({ ...msg, role: 'assistant' });

    for (const tc of toolCalls) {
      const p = parseToolCall(tc);
      const rawId = typeof tc === 'object' && tc !== null && typeof tc.id === 'string' ? tc.id : '';
      if (!p) {
        if (rawId) {
          messages.push({
            role: 'tool',
            tool_call_id: rawId,
            content: JSON.stringify({ ok: false, error: 'invalid_tool_call' }),
          });
        }
        continue;
      }
      let argsObj = {};
      try {
        argsObj = JSON.parse(p.arguments || '{}');
      } catch {
        argsObj = {};
      }
      const result = await executeTool(prisma, userId, writableKeys, redactedKeys, p.name, argsObj);
      messages.push({
        role: 'tool',
        tool_call_id: p.id,
        content: JSON.stringify(result),
      });
    }
  }

  res.status(502).json({ error: 'Слишком много шагов с инструментами (лимит ассистента).' });
}

import { randomUUID } from 'node:crypto';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const MAX_TOOL_ROUNDS = 5;
const MAX_CLIENT_MESSAGES = 40;
const LIST_FETCH_CAP = 200;

/** Схемы инструментов (OpenAI-style); ниже конвертируются в Gemini functionDeclarations. */
const OPENAI_STYLE_TOOLS = [
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
        'Создать запись. id генерируется автоматически. Передай поля согласно схеме (date YYYY-MM-DD и т.д.).',
      parameters: {
        type: 'object',
        properties: {
          fields: {
            type: 'object',
            description: 'Пары ключ-значение полей записи (без id)',
            additionalProperties: true,
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
      description: 'Обновить поля записи по id (частичное слияние с существующими данными).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fields: { type: 'object', additionalProperties: true, description: 'Только изменяемые поля' },
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

const GEMINI_FUNCTION_DECLARATIONS = OPENAI_STYLE_TOOLS.map((t) => {
  const fn = /** @type {{ name: string; description?: string; parameters?: unknown }} */ (t.function);
  return {
    name: fn.name,
    description: fn.description ?? '',
    parameters: fn.parameters ?? { type: 'object', properties: {} },
  };
});

function geminiGenerateUrl(modelId) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} userId
 */
async function loadAllowedFieldKeys(prisma, userId) {
  const rows = await prisma.fieldDefinition.findMany({
    where: { userId },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} userId
 */
async function buildFieldsSummary(prisma, userId) {
  const rows = await prisma.fieldDefinition.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
    select: { key: true, label: true, type: true },
  });
  if (rows.length === 0) return '(поля не настроены)';
  return rows.map((r) => `${r.key} (${r.label}, тип ${r.type})`).join('; ');
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
 * @param {Set<string>} allowedKeys
 * @param {string} name
 * @param {unknown} rawArgs
 */
async function executeTool(prisma, userId, allowedKeys, name, rawArgs) {
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
      if (!rowMatchesQuery(dataOnly, query)) continue;
      out.push(api);
      if (out.length >= limit) break;
    }
    return { ok: true, bookings: out, count: out.length };
  }

  if (name === 'get_booking') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    if (!id) return { ok: false, error: 'id required' };
    const row = await prisma.booking.findFirst({ where: { id, userId } });
    if (!row) return { ok: false, error: 'not_found' };
    return { ok: true, booking: rowToApi(row) };
  }

  if (name === 'create_booking') {
    const fields = args.fields && typeof args.fields === 'object' && !Array.isArray(args.fields) ? args.fields : null;
    if (!fields) return { ok: false, error: 'fields object required' };
    const id = randomUUID();
    const data = {};
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
      if (allowedKeys.has(k)) data[k] = v;
    }
    if (data.date != null && typeof data.date === 'string') data.date = data.date.trim();
    try {
      const row = await prisma.booking.create({
        data: { id, userId, data },
      });
      return { ok: true, booking: rowToApi(row) };
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
      if (allowedKeys.has(k)) base[k] = v;
    }
    if (base.date != null && typeof base.date === 'string') base.date = base.date.trim();
    const row = await prisma.booking.update({
      where: { id },
      data: { data: base, updatedAt: new Date() },
    });
    return { ok: true, booking: rowToApi(row) };
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
 * @param {{ role: string; content: string }[]} trimmed
 * @returns {{ role: string; parts: { text: string }[] }[]}
 */
function clientMessagesToGeminiContents(trimmed) {
  const out = [];
  for (const m of trimmed) {
    const geminiRole = m.role === 'assistant' ? 'model' : 'user';
    out.push({ role: geminiRole, parts: [{ text: m.content }] });
  }
  return out;
}

/**
 * @param {unknown} part
 * @returns {{ name: string; args: unknown; id?: string } | null}
 */
function parseFunctionCallPart(part) {
  if (!part || typeof part !== 'object') return null;
  const fc = /** @type {{ functionCall?: unknown }} */ (part).functionCall;
  if (!fc || typeof fc !== 'object') return null;
  const name = /** @type {{ name?: unknown }} */ (fc).name;
  const args = /** @type {{ args?: unknown }} */ (fc).args;
  const id = /** @type {{ id?: unknown }} */ (fc).id;
  if (typeof name !== 'string' || !name) return null;
  return {
    name,
    args: args !== undefined ? args : {},
    id: typeof id === 'string' && id ? id : undefined,
  };
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
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) {
    res.status(503).json({
      error: 'Не задан GEMINI_API_KEY в server/.env (ключ: https://aistudio.google.com/apikey).',
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
  const allowedKeys = await loadAllowedFieldKeys(prisma, userId);
  const fieldsSummary = await buildFieldsSummary(prisma, userId);

  const systemContent = [
    'Ты помощник в приложении Base56: записи клиентов (брони) с настраиваемыми полями.',
    'Поле даты записи: ключ date, формат YYYY-MM-DD.',
    `Доступные ключи полей пользователя: ${fieldsSummary}`,
    'Вызывай инструменты для чтения и изменения данных; не выдумывай id записей — получай их из list_bookings или get_booking.',
    'Удаляй записи (delete_booking) только если пользователь явно попросил удалить.',
    'Отвечай по-русски, кратко, по существу.',
  ].join('\n');

  /** @type {{ role: string; parts: unknown[] }[]} */
  const contents = clientMessagesToGeminiContents(trimmed);

  const url = geminiGenerateUrl(modelId);
  const toolsPayload = [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }];

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    let geminiRes;
    try {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemContent }] },
          contents,
          tools: toolsPayload,
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0.3 },
        }),
      });
    } catch (err) {
      console.error('[assistant] fetch gemini', err);
      res.status(502).json({ error: `Сеть: не удалось связаться с Gemini (${String(err?.message || err)})` });
      return;
    }

    const rawText = await geminiRes.text();
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      res.status(502).json({ error: 'Gemini вернул не-JSON.' });
      return;
    }

    if (!geminiRes.ok) {
      const errObj = data && data.error;
      const msg =
        (errObj && (errObj.message || errObj.status)) || rawText.slice(0, 500) || geminiRes.statusText;
      const status = geminiRes.status === 429 ? 429 : 502;
      res.status(status).json({ error: String(msg) });
      return;
    }

    if (data.promptFeedback?.blockReason) {
      res.status(502).json({ error: `Запрос отклонён моделью: ${String(data.promptFeedback.blockReason)}` });
      return;
    }

    const candidate = data.candidates && data.candidates[0];
    if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) {
      res.status(502).json({ error: 'Пустой ответ модели (нет candidates).' });
      return;
    }

    const finish = candidate.finishReason ? String(candidate.finishReason) : '';
    if (finish === 'SAFETY' || finish === 'BLOCKLIST' || finish === 'PROHIBITED_CONTENT') {
      res.status(502).json({ error: `Ответ остановлен: ${finish}` });
      return;
    }

    const parts = candidate.content.parts;
    const textPieces = [];
    const functionCalls = [];
    for (const part of parts) {
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
        textPieces.push(part.text);
      }
      const fc = parseFunctionCallPart(part);
      if (fc) functionCalls.push(fc);
    }

    if (functionCalls.length === 0) {
      res.json({
        message: { role: 'assistant', content: textPieces.join('\n').trim() },
        model: modelId,
      });
      return;
    }

    contents.push({ role: 'model', parts: JSON.parse(JSON.stringify(parts)) });

    const userFrParts = [];
    for (const fc of functionCalls) {
      const result = await executeTool(prisma, userId, allowedKeys, fc.name, fc.args);
      const fr = { name: fc.name, response: result };
      if (fc.id) /** @type {{ id?: string }} */ (fr).id = fc.id;
      userFrParts.push({ functionResponse: fr });
    }
    contents.push({ role: 'user', parts: userFrParts });
  }

  res.status(502).json({ error: 'Слишком много шагов с инструментами (лимит ассистента).' });
}

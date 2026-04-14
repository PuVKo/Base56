import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';

/** @type {import('nodemailer').Transporter | null} */
let smtpTransporter = null;

function smtpPassword() {
  return (process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? '').trim();
}

function rusenderApiKey() {
  return (process.env.RUSENDER_API_KEY ?? '').trim();
}

/**
 * Email API RuSender: https://api.rusender.ru/api/v1/external-mails/send
 * Ключ в заголовке X-Api-Key; отправитель — MAIL_FROM или RUSENDER_FROM_EMAIL (домен должен быть подтверждён в RuSender).
 */
export function isRusenderConfigured() {
  const from = parseMailFromForRusender();
  return Boolean(rusenderApiKey() && from.email);
}

/** @returns {{ email: string, name?: string }} */
function parseMailFromForRusender() {
  const raw = (process.env.MAIL_FROM ?? process.env.RUSENDER_FROM_EMAIL ?? '').trim();
  if (!raw) return { email: '' };
  const angle = raw.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (angle) {
    const name = angle[1].trim().replace(/^["']|["']$/g, '');
    const email = angle[2].trim();
    return name ? { email, name } : { email };
  }
  return { email: raw };
}

/**
 * SMTP (Timeweb Cloud и др.): SMTP_HOST, SMTP_USER, SMTP_PASS (или SMTP_PASSWORD).
 * Порты: 465 + SSL (SMTP_SECURE=1) или 587 STARTTLS (SMTP_PORT=587, SMTP_SECURE=0).
 */
export function isSmtpConfigured() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = smtpPassword();
  return Boolean(host && user && pass);
}

function getOrCreateSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = smtpPassword();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  const s = (process.env.SMTP_SECURE ?? '').trim().toLowerCase();
  let secure;
  if (s === '1' || s === 'true' || s === 'yes') secure = true;
  else if (s === '0' || s === 'false' || s === 'no') secure = false;
  else secure = port === 465;

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && (port === 587 || port === 2525),
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 20_000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 15_000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 45_000),
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== '0',
    },
  });
  return smtpTransporter;
}

/**
 * @param {Record<string, string | undefined>} payload
 */
async function sendViaSmtp(payload) {
  const transport = getOrCreateSmtpTransporter();
  if (!transport) {
    throw new Error('SMTP: не заданы SMTP_HOST / SMTP_USER / SMTP_PASS');
  }
  const to = (payload.to ?? payload.email ?? '').trim();
  if (!to) {
    throw new Error('SMTP: в письме нет получателя (to / email)');
  }
  const from =
    process.env.MAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    `Base56 <${process.env.SMTP_USER?.trim()}>`;
  const subject = (payload.subject ?? '').trim() || 'Base56';
  const text = payload.text ?? '';
  const html = payload.html?.trim() ? payload.html : undefined;

  await transport.sendMail({
    from,
    to,
    subject,
    text: text || undefined,
    html,
  });
  return { ok: true };
}

const RUSENDER_SEND_URL = (
  process.env.RUSENDER_API_URL ?? 'https://api.rusender.ru/api/v1/external-mails/send'
).trim();
const RUSENDER_FETCH_TIMEOUT_MS = Number(
  process.env.RUSENDER_API_TIMEOUT_MS ?? 20_000,
);

/**
 * @param {Record<string, string | undefined>} payload
 */
async function sendViaRusender(payload) {
  const key = rusenderApiKey();
  if (!key) {
    throw new Error('RuSender: не задан RUSENDER_API_KEY');
  }
  const from = parseMailFromForRusender();
  if (!from.email) {
    throw new Error(
      'RuSender: задайте MAIL_FROM или RUSENDER_FROM_EMAIL (email на подтверждённом домене)',
    );
  }
  const to = (payload.to ?? payload.email ?? '').trim();
  if (!to) {
    throw new Error('RuSender: нет получателя (to / email)');
  }
  const subject = (payload.subject ?? '').trim() || 'Base56';
  const text = payload.text ?? '';
  const html = payload.html?.trim() ? payload.html : undefined;
  if (!html && !text) {
    throw new Error('RuSender: в письме нет html или text');
  }

  /** @type {Record<string, unknown>} */
  const mail = {
    to: { email: to },
    from: { email: from.email, ...(from.name ? { name: from.name } : {}) },
    subject,
  };
  if (html) mail.html = html;
  if (text) mail.text = text;

  const body = {
    idempotencyKey: randomUUID(),
    mail,
  };

  const res = await fetch(RUSENDER_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Api-Key': key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RUSENDER_FETCH_TIMEOUT_MS),
  });
  const raw = await res.text();
  /** @type {unknown} */
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { _raw: raw };
  }
  if (!res.ok) {
    const msg =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : raw.slice(0, 500);
    throw new Error(`RuSender: HTTP ${res.status} — ${msg}`);
  }
  return { ok: true };
}

/**
 * Транзакционная почта: RuSender Email API или SMTP. Отладка: MAIL_MODE=console — только лог.
 * Если заданы и RuSender, и SMTP — приоритет у RuSender; для локалки без ключа RuSender остаётся SMTP.
 *
 * @param {Record<string, string | undefined>} payload
 */
export async function sendTransactionalMail(payload) {
  const mode = (process.env.MAIL_MODE ?? '').trim().toLowerCase();

  if (mode === 'console' || mode === 'log') {
    console.log('[mail]', JSON.stringify(payload, null, 2));
    return { ok: true };
  }

  if (isRusenderConfigured()) {
    return sendViaRusender(payload);
  }

  if (isSmtpConfigured()) {
    return sendViaSmtp(payload);
  }

  console.warn(
    '[mail] Не настроена почта — задайте RUSENDER_API_KEY + MAIL_FROM или SMTP_HOST, SMTP_USER, SMTP_PASS (см. server/.env.example)',
  );
  console.log('[mail]', JSON.stringify(payload, null, 2));
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Почта не настроена: задайте RUSENDER_API_KEY + MAIL_FROM или SMTP_HOST, SMTP_USER, SMTP_PASS',
    );
  }
  return { ok: true };
}

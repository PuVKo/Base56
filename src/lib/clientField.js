import { formatRu7Progressive, parseRuPhoneDigits } from '@/lib/ruPhoneMask';

/**
 * @typedef {{ name: string, phone: string }} ClientFieldValue phone — 10 цифр или ''
 */

/**
 * @param {unknown} raw
 * @returns {ClientFieldValue}
 */
export function normalizeClientFieldValue(raw) {
  if (raw == null) return { name: '', phone: '' };
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t ? { name: t, phone: '' } : { name: '', phone: '' };
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const phone = parseRuPhoneDigits(String(o.phone ?? ''));
    return { name, phone };
  }
  return { name: '', phone: '' };
}

/**
 * @param {unknown} v
 */
export function formatClientDisplay(v) {
  const { name, phone } = normalizeClientFieldValue(v);
  const p = phone ? formatRu7Progressive(phone) : '';
  if (name && p) return `${name} · ${p}`;
  if (name) return name;
  if (p) return p;
  return '';
}

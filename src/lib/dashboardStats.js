import { addMonths, endOfYear, isValid, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { STATUSES } from '@/data/constants';
import { getFieldOptionItems } from '@/lib/fieldOptions';
import { filterByMonth } from '@/lib/bookingUtils';

/** Пустая строка = явно «не выбрано», не смешивать с unknown из импорта */
function sourceAggregateKey(b) {
  const s = b.sourceId;
  if (s === undefined || s === null || s === '') return '';
  return s;
}

/** @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} list */
export function sumAmount(list) {
  return list.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
}

/** @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} list */
export function countByStatus(list) {
  const counts = { booked: 0, processing: 0, done: 0 };
  for (const b of list) {
    const s = b.status;
    if (s in counts) counts[s]++;
    else counts.booked++;
  }
  return counts;
}

/** @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} list */
export function sumBySource(list) {
  const m = new Map();
  for (const b of list) {
    const id = sourceAggregateKey(b);
    m.set(id, (m.get(id) || 0) + (Number(b.amount) || 0));
  }
  return Object.fromEntries(m);
}

/** @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} list */
export function countBySource(list) {
  const m = new Map();
  for (const b of list) {
    const id = sourceAggregateKey(b);
    m.set(id, (m.get(id) || 0) + 1);
  }
  return Object.fromEntries(m);
}

/**
 * @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} bookings
 * @param {Date} endMonth
 * @param {number} monthsBack
 */
export function revenueByMonth(bookings, endMonth, monthsBack) {
  const out = [];
  const end = startOfMonth(endMonth);
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = addMonths(end, -(monthsBack - 1 - i));
    const list = filterByMonth(bookings, monthDate);
    out.push({ month: monthDate, sum: sumAmount(list), count: list.length });
  }
  return out;
}

/**
 * Id статусов «Записан» и «Переговоры» по схеме поля (подписи без учёта регистра).
 * @param {any[] | undefined} fields
 */
function statusIdsBookedAndNegotiation(fields) {
  const ids = new Set(['booked']);
  const statusField = fields?.find((f) => f.key === 'status' || f.type === 'status');
  const items = statusField
    ? getFieldOptionItems(statusField)
    : STATUSES.map((s) => ({ id: s.id, label: s.label }));
  for (const it of items) {
    const l = String(it.label || '')
      .trim()
      .toLowerCase();
    if (l === 'записан' || l === 'переговоры') ids.add(it.id);
  }
  return ids;
}

/**
 * От сегодня до конца текущего календарного года; только «Записан» и «Переговоры».
 * @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} bookings
 * @param {any[] | undefined} fields
 */
export function upcomingBookingsInCalendarYear(bookings, fields) {
  const today = startOfDay(new Date());
  const yearEnd = endOfYear(new Date());
  const allowed = statusIdsBookedAndNegotiation(fields);
  return bookings
    .filter((b) => {
      const d = parseISO(b.date);
      if (!isValid(d) || d < today || d > yearEnd) return false;
      return allowed.has(b.status);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} bookings
 * @param {number} limit
 */
export function upcomingBookings(bookings, limit = 8) {
  const today = startOfDay(new Date());
  return bookings
    .filter((b) => {
      const d = parseISO(b.date);
      return isValid(d) && d >= today;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

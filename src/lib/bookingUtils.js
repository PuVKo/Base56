import {
  endOfMonth,
  getYear,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { normalizeClientFieldValue } from '@/lib/clientField';

/** @param {unknown} b */
export function normalizeBooking(b) {
  if (!b || typeof b !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (b);
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  const tagIds = Array.isArray(o.tagIds)
    ? o.tagIds.filter((x) => typeof x === 'string')
    : [];
  const comments = Array.isArray(o.comments) ? o.comments : [];
  const fixedKeys = new Set([
    'id',
    'title',
    'date',
    'timeRange',
    'description',
    'amount',
    'status',
    'sourceId',
    'clientName',
    'tagIds',
    'comments',
    'createdAt',
    'updatedAt',
  ]);
  const base = {
    id,
    title: typeof o.title === 'string' ? o.title : '',
    date: typeof o.date === 'string' ? o.date : '',
    timeRange: typeof o.timeRange === 'string' ? o.timeRange : '',
    description: typeof o.description === 'string' ? o.description : '',
    amount: typeof o.amount === 'number' ? o.amount : Number(o.amount) || 0,
    status: typeof o.status === 'string' ? o.status : 'booked',
    tagIds,
    sourceId: typeof o.sourceId === 'string' ? o.sourceId : '',
    clientName: normalizeClientFieldValue(o.clientName),
    comments: comments
      .map((c) => {
        if (!c || typeof c !== 'object') return null;
        const x = /** @type {Record<string, unknown>} */ (c);
        return {
          id: typeof x.id === 'string' ? x.id : '',
          text: typeof x.text === 'string' ? x.text : '',
          createdAt: typeof x.createdAt === 'string' ? x.createdAt : new Date().toISOString(),
        };
      })
      .filter(Boolean),
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
  };
  /** @type {Record<string, unknown>} */
  const out = { ...base };
  for (const [k, v] of Object.entries(o)) {
    if (fixedKeys.has(k)) continue;
    out[k] = v;
  }
  return /** @type {ReturnType<typeof normalizeBooking>} */ (out);
}

/**
 * @param {unknown[]} raw
 * @returns {ReturnType<typeof normalizeBooking>[]}
 */
export function normalizeBookings(raw) {
  return raw.map(normalizeBooking).filter(Boolean);
}

/**
 * @param {ReturnType<typeof normalizeBooking>} booking
 * @param {Date} monthCursor
 */
export function bookingInMonth(booking, monthCursor) {
  if (!booking?.date) return false;
  const d = parseISO(booking.date);
  if (!isValid(d)) return false;
  return isSameMonth(d, monthCursor);
}

/**
 * @param {ReturnType<typeof normalizeBooking>[]} list
 * @param {Date} monthCursor
 */
export function filterByMonth(list, monthCursor) {
  const start = startOfMonth(monthCursor);
  const end = endOfMonth(monthCursor);
  return list.filter((b) => {
    if (!b.date) return false;
    const d = parseISO(b.date);
    if (!isValid(d)) return false;
    return d >= start && d <= end;
  });
}

/**
 * Записи, у которых дата съёмки попадает в указанный календарный год.
 * @param {ReturnType<typeof normalizeBooking>[]} list
 * @param {number} year например 2026
 */
export function filterByCalendarYear(list, year) {
  return list.filter((b) => {
    if (!b.date) return false;
    const d = parseISO(b.date);
    if (!isValid(d)) return false;
    return getYear(d) === year;
  });
}

/**
 * Записи без даты (пустая / только пробелы) показываем вместе с выбранным месяцем;
 * с датой — только если дата попадает в календарный месяц monthCursor.
 * @param {ReturnType<typeof normalizeBooking>[]} list
 * @param {Date} monthCursor
 */
export function filterByMonthOrUndated(list, monthCursor) {
  const start = startOfMonth(monthCursor);
  const end = endOfMonth(monthCursor);
  return list.filter((b) => {
    const raw = typeof b.date === 'string' ? b.date.trim() : '';
    if (!raw) return true;
    const d = parseISO(raw);
    if (!isValid(d)) return true;
    return d >= start && d <= end;
  });
}

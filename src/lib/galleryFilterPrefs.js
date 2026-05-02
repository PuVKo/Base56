import { getYear } from 'date-fns';

import { filterByCalendarYear, filterByMonthOrUndated } from '@/lib/bookingUtils';
import { defaultGalleryFilters, normalizeClientUi, normalizeGalleryFilters } from '@/lib/galleryPrefsModel';

const KEY = 'base56-gallery-filters-v1';
const PANEL_KEY = 'base56-gallery-filters-panel-open';

/** @typedef {{
 *   period: 'all' | 'month' | 'year',
 *   year: number,
 *   statusIds: string[],
 *   sourceIds: string[],
 *   tagIds: string[],
 *   search: string,
 *   show: { period: boolean, status: boolean, source: boolean, tags: boolean, search: boolean },
 * }} GalleryFilterPrefs */

/** @returns {GalleryFilterPrefs} */
export function defaultGalleryPrefs() {
  return defaultGalleryFilters();
}

/** Легаси: чтение из localStorage (миграция в БД) */
export function loadGalleryPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultGalleryPrefs();
    const o = JSON.parse(raw);
    return normalizeGalleryFilters(/** @type {Record<string, unknown>} */ (o));
  } catch {
    return defaultGalleryPrefs();
  }
}

/** @param {GalleryFilterPrefs} prefs */
export function saveGalleryPrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function readGalleryPanelOpen() {
  try {
    return localStorage.getItem(PANEL_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} open */
export function saveGalleryPanelOpen(open) {
  try {
    localStorage.setItem(PANEL_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Однократная миграция LS → сервер: вызывать, если в БД ещё не сохраняли uiPrefs */
export function readLegacyClientUiFromLocalStorage() {
  try {
    const f = localStorage.getItem(KEY);
    const panel = readGalleryPanelOpen();
    if (!f) return null;
    const o = JSON.parse(f);
    const galleryFilters = normalizeGalleryFilters(/** @type {Record<string, unknown>} */ (o));
    return normalizeClientUi({ version: 1, galleryFilters, galleryFiltersPanelOpen: panel });
  } catch {
    return null;
  }
}

export function clearLegacyGalleryLocalStorage() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PANEL_KEY);
  } catch {
    /* ignore */
  }
}

/** @param {GalleryFilterPrefs} prefs @param {{ includePeriod?: boolean }} [opts] */
export function isViewFiltersActive(prefs, opts = {}) {
  const includePeriod = opts.includePeriod !== false;
  return (
    (includePeriod && prefs.period !== 'all') ||
    prefs.statusIds.length > 0 ||
    prefs.sourceIds.length > 0 ||
    prefs.tagIds.length > 0 ||
    prefs.search.trim() !== ''
  );
}

/** @param {GalleryFilterPrefs} prefs */
export function isGalleryPrefsActive(prefs) {
  return isViewFiltersActive(prefs, { includePeriod: true });
}

/**
 * На плитке/в карточке скрыто хотя бы одно поле — показываем точку на кнопке, пока панель закрыта.
 * @param {Record<string, boolean> | undefined} tileVisible
 */
export function isGalleryTileFieldPrefsActive(tileVisible) {
  if (!tileVisible || typeof tileVisible !== 'object') return false;
  return Object.values(tileVisible).some((v) => v === false);
}

/**
 * Статус/источник/теги/поиск (без периода).
 * @param {any[]} list
 * @param {GalleryFilterPrefs} prefs
 */
function applyNonPeriodFilters(list, prefs) {
  let out = list;
  if (prefs.statusIds.length > 0) {
    const set = new Set(prefs.statusIds);
    out = out.filter((b) => set.has(typeof b.status === 'string' ? b.status : ''));
  }
  if (prefs.sourceIds.length > 0) {
    const set = new Set(prefs.sourceIds);
    out = out.filter((b) => set.has(typeof b.sourceId === 'string' ? b.sourceId : ''));
  }
  if (prefs.tagIds.length > 0) {
    const set = new Set(prefs.tagIds);
    out = out.filter((b) => {
      const tags = Array.isArray(b.tagIds) ? b.tagIds : [];
      return tags.some((t) => set.has(t));
    });
  }

  const q = prefs.search.trim().toLowerCase();
  if (q) {
    out = out.filter((b) => {
      const title = String(b.title || '').toLowerCase();
      const desc = String(b.description || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }

  return out;
}

/**
 * @param {any[]} bookings
 * @param {GalleryFilterPrefs} prefs
 * @param {Date} monthCursor
 * @param {{ calendarView?: boolean, skipPeriod?: boolean }} [options]
 */
export function applyGalleryFilters(bookings, prefs, monthCursor, options = {}) {
  const { calendarView = false, skipPeriod = false } = options;
  let list = bookings;
  if (!skipPeriod) {
    if (calendarView) {
      list = filterByMonthOrUndated(bookings, monthCursor);
    } else if (prefs.period === 'month') {
      list = filterByMonthOrUndated(bookings, monthCursor);
    } else if (prefs.period === 'year') {
      list = filterByCalendarYear(bookings, getYear(monthCursor));
    }
  }

  return applyNonPeriodFilters(list, prefs);
}

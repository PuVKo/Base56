/** Общая модель настроек плиток (без localStorage) — клиент и сервер */

/** @returns {ReturnType<typeof defaultGalleryFilters>} */
export function defaultGalleryFilters() {
  const y = new Date().getFullYear();
  return {
    period: 'all',
    year: y,
    statusIds: [],
    sourceIds: [],
    tagIds: [],
    search: '',
    show: { period: true, status: true, source: true, tags: true, search: true },
  };
}

/** @param {Record<string, unknown>} raw */
export function normalizeGalleryFilters(raw) {
  const d = defaultGalleryFilters();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw.show && typeof raw.show === 'object' ? /** @type {Record<string, unknown>} */ (raw.show) : {};
  return {
    period: raw.period === 'month' || raw.period === 'year' ? raw.period : 'all',
    year: Number.isFinite(raw.year) ? Number(raw.year) : d.year,
    statusIds: Array.isArray(raw.statusIds) ? raw.statusIds.filter((x) => typeof x === 'string') : [],
    sourceIds: Array.isArray(raw.sourceIds) ? raw.sourceIds.filter((x) => typeof x === 'string') : [],
    tagIds: Array.isArray(raw.tagIds) ? raw.tagIds.filter((x) => typeof x === 'string') : [],
    search: typeof raw.search === 'string' ? raw.search : '',
    show: {
      period: s.period !== false,
      status: s.status !== false,
      source: s.source !== false,
      tags: s.tags !== false,
      search: s.search !== false,
    },
  };
}

/** @param {unknown} raw */
export function normalizeGalleryTileFieldVisible(raw) {
  /** @type {Record<string, boolean>} */
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (raw))) {
    if (typeof k === 'string' && typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * @typedef {ReturnType<typeof defaultGalleryFilters>} GalleryFilterPrefs
 * @typedef {{
 *   version: number,
 *   galleryFilters: GalleryFilterPrefs,
 *   galleryFiltersPanelOpen: boolean,
 *   galleryTileFieldVisible: Record<string, boolean>,
 *   galleryTileFieldsPanelOpen: boolean,
 *   calendarFilters: GalleryFilterPrefs,
 *   calendarFiltersPanelOpen: boolean,
 *   calendarTileFieldVisible: Record<string, boolean>,
 *   calendarTileFieldsPanelOpen: boolean,
 *   tableFilters: GalleryFilterPrefs,
 *   tableFiltersPanelOpen: boolean,
 *   tableTileFieldVisible: Record<string, boolean>,
 *   tableTileFieldsPanelOpen: boolean,
 *   dashboardPeriod: 'month' | 'year' | 'all',
 *   dashboardPeriodPanelOpen: boolean,
 * }} ClientUiPayload
 */

/** @returns {ClientUiPayload} */
export function defaultClientUi() {
  return {
    version: 1,
    galleryFilters: defaultGalleryFilters(),
    galleryFiltersPanelOpen: false,
    galleryTileFieldVisible: {},
    galleryTileFieldsPanelOpen: false,
    calendarFilters: defaultGalleryFilters(),
    calendarFiltersPanelOpen: false,
    calendarTileFieldVisible: {},
    calendarTileFieldsPanelOpen: false,
    tableFilters: defaultGalleryFilters(),
    tableFiltersPanelOpen: false,
    tableTileFieldVisible: {},
    tableTileFieldsPanelOpen: false,
    dashboardPeriod: 'month',
    dashboardPeriodPanelOpen: false,
  };
}

/** @param {unknown} raw */
export function normalizeClientUi(raw) {
  if (!raw || typeof raw !== 'object') return defaultClientUi();
  const o = /** @type {Record<string, unknown>} */ (raw);
  const gf = o.galleryFilters && typeof o.galleryFilters === 'object' ? o.galleryFilters : {};
  const cf = o.calendarFilters && typeof o.calendarFilters === 'object' ? o.calendarFilters : {};
  const tf = o.tableFilters && typeof o.tableFilters === 'object' ? o.tableFilters : {};
  return {
    version: typeof o.version === 'number' ? o.version : 1,
    galleryFilters: normalizeGalleryFilters(/** @type {Record<string, unknown>} */ (gf)),
    galleryFiltersPanelOpen: typeof o.galleryFiltersPanelOpen === 'boolean' ? o.galleryFiltersPanelOpen : false,
    galleryTileFieldVisible: normalizeGalleryTileFieldVisible(o.galleryTileFieldVisible),
    galleryTileFieldsPanelOpen: typeof o.galleryTileFieldsPanelOpen === 'boolean' ? o.galleryTileFieldsPanelOpen : false,
    calendarFilters: normalizeGalleryFilters(/** @type {Record<string, unknown>} */ (cf)),
    calendarFiltersPanelOpen: typeof o.calendarFiltersPanelOpen === 'boolean' ? o.calendarFiltersPanelOpen : false,
    calendarTileFieldVisible: normalizeGalleryTileFieldVisible(o.calendarTileFieldVisible),
    calendarTileFieldsPanelOpen: typeof o.calendarTileFieldsPanelOpen === 'boolean' ? o.calendarTileFieldsPanelOpen : false,
    tableFilters: normalizeGalleryFilters(/** @type {Record<string, unknown>} */ (tf)),
    tableFiltersPanelOpen: typeof o.tableFiltersPanelOpen === 'boolean' ? o.tableFiltersPanelOpen : false,
    tableTileFieldVisible: normalizeGalleryTileFieldVisible(o.tableTileFieldVisible),
    tableTileFieldsPanelOpen: typeof o.tableTileFieldsPanelOpen === 'boolean' ? o.tableTileFieldsPanelOpen : false,
    dashboardPeriod:
      o.dashboardPeriod === 'year' || o.dashboardPeriod === 'all' ? o.dashboardPeriod : 'month',
    dashboardPeriodPanelOpen:
      typeof o.dashboardPeriodPanelOpen === 'boolean' ? o.dashboardPeriodPanelOpen : false,
  };
}

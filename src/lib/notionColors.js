/** @typedef {'gray'|'brown'|'orange'|'yellow'|'green'|'blue'|'purple'|'pink'|'red'} NotionColorKey */

/** @type {NotionColorKey[]} */
export const NOTION_COLOR_KEYS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
];

/**
 * Непрозрачные фоны: не смешиваются с фоном страницы при смене светлой/тёмной темы
 * (в отличие от полупрозрачных Tailwind-классов поверх --bg).
 */
const MAP = {
  gray: 'bg-zinc-700 text-zinc-50 border border-zinc-500/90',
  brown: 'bg-amber-900 text-amber-50 border border-amber-700/90',
  orange: 'bg-orange-800 text-orange-50 border border-orange-600/90',
  yellow: 'bg-yellow-800 text-yellow-50 border border-yellow-600/90',
  green: 'bg-emerald-800 text-emerald-50 border border-emerald-600/90',
  blue: 'bg-blue-800 text-blue-50 border border-blue-600/90',
  purple: 'bg-violet-800 text-violet-50 border border-violet-600/90',
  pink: 'bg-pink-800 text-pink-50 border border-pink-600/90',
  red: 'bg-red-800 text-red-50 border border-red-600/90',
};

/**
 * @param {string | undefined} color
 * @returns {string} Tailwind classes
 */
/** Маркер для единого CSS-«фильтра» бейджей в светлой теме (`html.light .pill-chroma` в index.css) */
export const PILL_CHROMA_CLASS = 'pill-chroma';

export function notionPillClasses(color) {
  const k = NOTION_COLOR_KEYS.includes(/** @type {NotionColorKey} */ (color)) ? color : 'gray';
  return `${MAP[k] || MAP.gray} ${PILL_CHROMA_CLASS}`;
}

/**
 * @param {string | undefined} color
 */
export function normalizeNotionColor(color) {
  return NOTION_COLOR_KEYS.includes(/** @type {NotionColorKey} */ (color)) ? color : 'gray';
}

/**
 * Сплошной цвет для SVG (круговые диаграммы и т.п.) — тот же ключ, что у бейджей источников/полей.
 * @type {Record<NotionColorKey, string>}
 */
export const NOTION_CHART_FILL_HEX = {
  gray: '#71717a',
  brown: '#d97706',
  orange: '#ea580c',
  yellow: '#ca8a04',
  green: '#059669',
  blue: '#3b82f6',
  purple: '#7c3aed',
  pink: '#db2777',
  red: '#dc2626',
};

/**
 * @param {string | undefined} color — ключ из настроек поля (gray, blue, …)
 * @returns {string} `#rrggbb`
 */
export function notionColorFillHex(color) {
  const k = normalizeNotionColor(color);
  return NOTION_CHART_FILL_HEX[k] ?? NOTION_CHART_FILL_HEX.gray;
}

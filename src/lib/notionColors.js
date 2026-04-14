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

/** Pill + selected ring styles (dark UI) */
const MAP = {
  gray: 'bg-zinc-600/35 text-zinc-100 border-zinc-500/40',
  brown: 'bg-amber-900/45 text-amber-100 border-amber-700/40',
  orange: 'bg-orange-600/30 text-orange-100 border-orange-500/40',
  yellow: 'bg-yellow-600/25 text-yellow-100 border-yellow-500/35',
  green: 'bg-emerald-600/30 text-emerald-100 border-emerald-500/40',
  blue: 'bg-blue-600/30 text-blue-100 border-blue-500/40',
  purple: 'bg-violet-600/30 text-violet-100 border-violet-500/40',
  pink: 'bg-pink-600/30 text-pink-100 border-pink-500/40',
  red: 'bg-red-600/30 text-red-100 border-red-500/40',
};

/**
 * @param {string | undefined} color
 * @returns {string} Tailwind classes
 */
export function notionPillClasses(color) {
  const k = NOTION_COLOR_KEYS.includes(/** @type {NotionColorKey} */ (color)) ? color : 'gray';
  return MAP[k] || MAP.gray;
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

import { SOURCES, STATUSES, TAGS, sourceById, statusById, tagById } from '@/data/constants';
import { notionPillClasses } from '@/lib/notionColors';

/** @typedef {{ id: string, label: string, color?: string }} FieldOptionItem */

/** Стабильный короткий хэш строки (без crypto API) — для уникальных id при дублях. */
function hash6(label) {
  let h = 0;
  const s = String(label);
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 10);
}

/**
 * В БД после старых импортов у нескольких вариантов мог совпадать id (например partner) — в UI
 * все такие кнопки подсвечивались сразу. Делаем id уникальными по подписи.
 * @param {FieldOptionItem[]} items
 */
function uniquifyOptionIds(items) {
  const used = new Set();
  const out = [];
  for (const x of items) {
    let id = x.id;
    if (used.has(id)) {
      let suffix = hash6(x.label);
      id = `${x.id}__${suffix}`;
      let n = 0;
      while (used.has(id)) {
        n += 1;
        id = `${x.id}__${suffix}_${n}`;
      }
    }
    used.add(id);
    out.push({ ...x, id });
  }
  return out;
}

/**
 * @param {any} field
 * @returns {FieldOptionItem[]}
 */
export function getFieldOptionItems(field) {
  const raw = field?.options?.items;
  if (Array.isArray(raw) && raw.length > 0) {
    const mapped = raw
      .filter((x) => x && typeof x.id === 'string' && typeof x.label === 'string')
      .map((x) => ({ id: x.id, label: x.label, color: typeof x.color === 'string' ? x.color : 'gray' }));
    return uniquifyOptionIds(mapped);
  }
  if (field.type === 'status' || field.key === 'status') {
    return STATUSES.map((s, i) => ({
      id: s.id,
      label: s.label,
      color: ['blue', 'pink', 'green'][i] ?? 'gray',
    }));
  }
  if (field.type === 'tags' || field.key === 'tagIds') {
    return TAGS.map((t) => ({
      id: t.id,
      label: t.label,
      color: t.id === 'photo' ? 'purple' : 'gray',
    }));
  }
  if (field.type === 'source' || field.key === 'sourceId') {
    const colors = ['green', 'brown', 'orange', 'gray'];
    return SOURCES.map((s, i) => ({
      id: s.id,
      label: s.label,
      color: colors[i] ?? 'gray',
    }));
  }
  return [];
}

/**
 * @param {any} field
 */
export function fieldUsesOptionList(field) {
  return (
    field.type === 'select' ||
    field.type === 'multiselect' ||
    field.type === 'status' ||
    field.type === 'tags' ||
    field.type === 'source'
  );
}

/**
 * Подпись и стиль бейджа из настроек поля (как в модалке), с запасным вариантом по константам.
 * @param {any[] | undefined} fields
 * @param {'status' | 'sourceId' | 'tagIds'} fieldKey
 * @param {string | undefined} valueId
 */
export function pillDisplayForField(fields, fieldKey, valueId) {
  const field = fields?.find((f) => f.key === fieldKey);
  const items = field ? getFieldOptionItems(field) : [];
  const opt = items.find((x) => x.id === valueId);
  if (opt) {
    return { label: opt.label, className: notionPillClasses(opt.color) };
  }
  if (fieldKey === 'sourceId' && (valueId === undefined || valueId === null || valueId === '')) {
    return { label: 'Без источника', className: notionPillClasses('gray') };
  }
  if (fieldKey === 'status' && (valueId === undefined || valueId === null || valueId === '')) {
    const s = statusById('');
    return { label: s.label, className: s.className };
  }
  if (fieldKey === 'status') {
    const s = statusById(valueId);
    return { label: s.label, className: s.className };
  }
  if (fieldKey === 'sourceId') {
    const s = sourceById(valueId);
    return { label: s.label, className: s.className };
  }
  if (fieldKey === 'tagIds') {
    const t = tagById(valueId);
    if (t) return { label: t.label, className: t.className };
    return { label: valueId || '—', className: notionPillClasses('gray') };
  }
  return { label: valueId || '—', className: notionPillClasses('gray') };
}

/**
 * Бейдж тега: сначала варианты из настроек поля, иначе константы (старые id).
 * @param {any | undefined} tagsField — поле type tags / key tagIds
 * @param {string} tid
 * @returns {{ label: string, className: string } | null}
 */
export function tagPillFromFieldOrConstants(tagsField, tid) {
  if (!tid || typeof tid !== 'string') return null;
  const items = tagsField ? getFieldOptionItems(tagsField) : [];
  const opt = items.find((x) => x.id === tid);
  if (opt) {
    return { label: opt.label, className: notionPillClasses(opt.color || 'gray') };
  }
  const t = tagById(tid);
  if (t) return { label: t.label, className: t.className };
  return { label: tid, className: notionPillClasses('gray') };
}

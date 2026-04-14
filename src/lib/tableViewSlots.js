/** Порядок столбцов таблицы (соответствие полям формы). */
export const TABLE_SLOT_ORDER = [
  'date',
  'title',
  'time',
  'description',
  'amount',
  'status',
  'tags',
  'source',
  'client',
];

/** @param {any} f */
export function tableSlotForField(f) {
  const k = f.key;
  const t = f.type;
  if (k === 'date' || t === 'date') return 'date';
  if (k === 'title') return 'title';
  if (k === 'timeRange' || (t === 'time' && k === 'timeRange')) return 'time';
  if (k === 'description') return 'description';
  if (k === 'amount' || (t === 'number' && k === 'amount')) return 'amount';
  if (k === 'status' || t === 'status') return 'status';
  if (k === 'tagIds' || t === 'tags') return 'tags';
  if (k === 'sourceId' || t === 'source') return 'source';
  if (k === 'clientName' || t === 'client') return 'client';
  return null;
}

/** @param {string} slot @param {any[]} fields */
export function fieldForTableSlot(slot, fields) {
  const sorted = [...(fields || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((f) => tableSlotForField(f) === slot);
}

/**
 * @param {string} slot
 * @param {any[]} fields
 * @param {Record<string, boolean>} tableTileFieldVisible
 */
export function isTableSlotVisible(slot, fields, tableTileFieldVisible) {
  const f = fieldForTableSlot(slot, fields);
  if (!f) return true;
  return tableTileFieldVisible[f.id] !== false;
}

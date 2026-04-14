import { format } from 'date-fns';
import { newId } from '@/lib/id';

/**
 * @param {string | undefined} isoDate yyyy-MM-dd; если не передан — подставляется сегодня (локальный день)
 * @param {{ key: string, type: string }[]} fields
 */
export function createEmptyBooking(isoDate, fields) {
  const t = new Date().toISOString();
  const date =
    typeof isoDate === 'string' && isoDate.trim()
      ? isoDate.trim()
      : format(new Date(), 'yyyy-MM-dd');
  /** @type {Record<string, unknown>} */
  const draft = {
    id: newId(),
    title: '',
    date,
    timeRange: '',
    description: '',
    amount: 0,
    status: '',
    tagIds: [],
    sourceId: '',
    clientName: { name: '', phone: '' },
    comments: [],
    createdAt: t,
    updatedAt: t,
  };

  for (const f of fields || []) {
    if (f.key in draft) continue;
    if (f.type === 'number') draft[f.key] = 0;
    else if (f.type === 'date') draft[f.key] = '';
    else if (f.type === 'checkbox') draft[f.key] = false;
    else if (f.type === 'multiselect') draft[f.key] = [];
    else if (f.type === 'comments') draft[f.key] = [];
    else if (f.type === 'client') draft[f.key] = { name: '', phone: '' };
    else if (f.type === 'select') draft[f.key] = '';
    else draft[f.key] = '';
  }
  return draft;
}

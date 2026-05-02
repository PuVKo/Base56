import { PILL_CHROMA_CLASS } from '@/lib/notionColors';

/** @param {string} base Tailwind-классы бейджа без маркера светлой темы */
function pc(base) {
  return `${base} ${PILL_CHROMA_CLASS}`;
}

/** @typedef {{ id: string, label: string, className: string }} Option */

/** @type {Option[]} */
export const STATUSES = [
  {
    id: 'booked',
    label: 'Записан',
    className: pc('bg-blue-800 text-blue-50 border border-blue-600/90'),
  },
  {
    id: 'processing',
    label: 'Обрабатывается',
    className: pc('bg-pink-800 text-pink-50 border border-pink-600/90'),
  },
  {
    id: 'done',
    label: 'Завершен',
    className: pc('bg-emerald-800 text-emerald-50 border border-emerald-600/90'),
  },
];

/** @type {Option[]} */
export const TAGS = [
  {
    id: 'photo',
    label: 'Фотография',
    className: pc('bg-violet-800 text-violet-50 border border-violet-600/90'),
  },
  {
    id: 'it',
    label: 'IT',
    className: pc('bg-zinc-700 text-zinc-50 border border-zinc-500/90'),
  },
];

/** @type {Option[]} */
export const SOURCES = [
  {
    id: 'avito',
    label: 'Авито',
    className: pc('bg-green-800 text-green-50 border border-green-600/90'),
  },
  {
    id: 'limpo',
    label: 'Лимпо Клуб',
    className: pc('bg-amber-900 text-amber-50 border border-amber-700/90'),
  },
  {
    id: 'partner',
    label: 'Партнёр',
    className: pc('bg-orange-800 text-orange-50 border border-orange-600/90'),
  },
  {
    id: 'unknown',
    label: 'Неизвестно',
    className: pc('bg-slate-700 text-slate-50 border border-slate-500/90'),
  },
  {
    id: 'direct',
    label: 'Напрямую',
    className: pc('bg-slate-700 text-slate-50 border border-slate-500/90'),
  },
];

export function statusById(id) {
  if (id === undefined || id === null || id === '') {
    return {
      id: '',
      label: 'Не выбран',
      className: pc('bg-zinc-700 text-zinc-200 border border-zinc-500/90'),
    };
  }
  const hit = STATUSES.find((s) => s.id === id);
  if (hit) return hit;
  if (id && String(id).startsWith('st_')) {
    return {
      id,
      label: 'Статус (Notion)',
      className: pc('bg-zinc-700 text-zinc-50 border border-zinc-500/90'),
    };
  }
  return STATUSES[0];
}

export function tagById(id) {
  return TAGS.find((t) => t.id === id);
}

export function sourceById(id) {
  if (id === undefined || id === null || id === '') {
    return {
      id: '',
      label: 'Не выбрано',
      className: pc('bg-zinc-700 text-zinc-200 border border-zinc-500/90'),
    };
  }
  const hit = SOURCES.find((s) => s.id === id);
  if (hit) return hit;
  if (id && String(id).startsWith('src_')) {
    return {
      id,
      label: 'Другой источник',
      className: pc('bg-zinc-700 text-zinc-50 border border-zinc-500/90'),
    };
  }
  return (
    SOURCES.find((s) => s.id === 'unknown') ?? {
      id: 'unknown',
      label: 'Неизвестно',
      className: pc('bg-slate-700 text-slate-50 border border-slate-500/90'),
    }
  );
}

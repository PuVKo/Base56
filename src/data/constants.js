/** @typedef {{ id: string, label: string, className: string }} Option */

/** @type {Option[]} */
export const STATUSES = [
  {
    id: 'booked',
    label: 'Записан',
    className: 'bg-blue-500/15 text-blue-200 border border-blue-500/35',
  },
  {
    id: 'processing',
    label: 'Обрабатывается',
    className: 'bg-pink-500/15 text-pink-200 border border-pink-500/35',
  },
  {
    id: 'done',
    label: 'Завершен',
    className: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/35',
  },
];

/** @type {Option[]} */
export const TAGS = [
  {
    id: 'photo',
    label: 'Фотография',
    className: 'bg-violet-500/15 text-violet-200 border border-violet-500/35',
  },
  {
    id: 'it',
    label: 'IT',
    className: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/35',
  },
];

/** @type {Option[]} */
export const SOURCES = [
  {
    id: 'avito',
    label: 'Авито',
    className: 'bg-green-500/15 text-green-200 border border-green-500/35',
  },
  {
    id: 'limpo',
    label: 'Лимпо Клуб',
    className: 'bg-amber-800/25 text-amber-100 border border-amber-600/35',
  },
  {
    id: 'partner',
    label: 'Партнёр',
    className: 'bg-orange-500/15 text-orange-200 border border-orange-500/35',
  },
  {
    id: 'unknown',
    label: 'Неизвестно',
    className: 'bg-slate-500/15 text-slate-200 border border-slate-500/35',
  },
  {
    id: 'direct',
    label: 'Напрямую',
    className: 'bg-slate-500/15 text-slate-200 border border-slate-500/35',
  },
];

export function statusById(id) {
  if (id === undefined || id === null || id === '') {
    return {
      id: '',
      label: 'Не выбран',
      className: 'bg-zinc-600/25 text-zinc-400 border border-zinc-500/35',
    };
  }
  const hit = STATUSES.find((s) => s.id === id);
  if (hit) return hit;
  if (id && String(id).startsWith('st_')) {
    return {
      id,
      label: 'Статус (Notion)',
      className: 'bg-zinc-500/15 text-zinc-200 border border-zinc-500/35',
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
      className: 'bg-zinc-600/25 text-zinc-400 border border-zinc-500/35',
    };
  }
  const hit = SOURCES.find((s) => s.id === id);
  if (hit) return hit;
  if (id && String(id).startsWith('src_')) {
    return {
      id,
      label: 'Другой источник',
      className: 'bg-zinc-500/15 text-zinc-200 border border-zinc-500/35',
    };
  }
  return (
    SOURCES.find((s) => s.id === 'unknown') ?? {
      id: 'unknown',
      label: 'Неизвестно',
      className: 'bg-slate-500/15 text-slate-200 border border-slate-500/35',
    }
  );
}

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SlidersHorizontal } from 'lucide-react';
import { notionPillClasses } from '@/lib/notionColors';
import { getFieldOptionItems } from '@/lib/fieldOptions';

/**
 * @param {any[] | undefined} fields
 */
function optionListsFromFields(fields) {
  const statusF = fields?.find((f) => f.key === 'status' || f.type === 'status');
  const tagsF = fields?.find((f) => f.key === 'tagIds' || f.type === 'tags');
  const srcF = fields?.find((f) => f.key === 'sourceId' || f.type === 'source');
  return {
    statusItems: statusF ? getFieldOptionItems(statusF) : [],
    tagItems: tagsF ? getFieldOptionItems(tagsF) : [],
    sourceItems: srcF ? getFieldOptionItems(srcF) : [],
  };
}

/** @param {string[]} arr @param {string} id */
function toggleId(arr, id) {
  const s = new Set(arr);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  return [...s];
}

/**
 * Панель фильтров (как в галерее). Без блока «Период» при hidePeriod (календарь).
 * @param {object} p
 * @param {import('@/lib/galleryPrefsModel').GalleryFilterPrefs} p.prefs
 * @param {(nextOrFn: import('@/lib/galleryPrefsModel').GalleryFilterPrefs | ((p: import('@/lib/galleryPrefsModel').GalleryFilterPrefs) => import('@/lib/galleryPrefsModel').GalleryFilterPrefs)) => void} p.setPrefs
 * @param {Date} p.monthCursor
 * @param {any[] | undefined} p.fields
 * @param {boolean} [p.hidePeriod]
 * @param {boolean} [p.hasFilters]
 * @param {() => void} [p.onReset]
 * @param {boolean} [p.embedded] в выезжающей панели — без внешней рамки, подсказка про навигацию в шапке
 */
export function ViewFiltersPanel({
  prefs,
  setPrefs,
  monthCursor,
  fields,
  hidePeriod = false,
  hasFilters,
  onReset,
  embedded = false,
}) {
  const [configureOpen, setConfigureOpen] = useState(false);
  const configureRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const { statusItems, tagItems, sourceItems } = optionListsFromFields(fields);

  useEffect(() => {
    if (!configureOpen) return;
    function onDoc(e) {
      if (configureRef.current && !configureRef.current.contains(/** @type {Node} */ (e.target))) {
        setConfigureOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [configureOpen]);

  const configureEntries = hidePeriod
    ? [
        ['status', 'Статус'],
        ['source', 'Источник'],
        ['tags', 'Теги'],
        ['search', 'Поиск'],
      ]
    : [
        ['period', 'Период'],
        ['status', 'Статус'],
        ['source', 'Источник'],
        ['tags', 'Теги'],
        ['search', 'Поиск'],
      ];

  const shell = embedded
    ? 'rounded-lg border border-notion-border/60 bg-notion-surface/50 p-3 sm:p-4'
    : 'rounded-xl border border-notion-border/80 bg-notion-surface/80 p-3 sm:p-4';

  return (
    <div className={shell}>
      <div
        className={`flex flex-wrap items-center gap-2 mb-3 ${
          embedded ? 'justify-end' : 'justify-between'
        }`}
      >
        {embedded ? null : <p className="text-sm font-medium text-white">Фильтры</p>}
        <div className="flex items-center gap-2">
          {hasFilters && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-notion-muted hover:text-white px-2 py-1 rounded-md border border-transparent hover:border-notion-border"
            >
              Сбросить
            </button>
          ) : null}
          <div className="relative" ref={configureRef}>
            <button
              type="button"
              onClick={() => setConfigureOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-notion-muted hover:text-white px-2 py-1 rounded-md border border-notion-border/80 hover:bg-notion-hover"
              aria-expanded={configureOpen}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Настроить панель
            </button>
            {configureOpen ? (
              <div className="absolute right-0 top-full z-[140] mt-1 min-w-[14rem] rounded-lg border border-notion-border bg-[#2a2a2a] shadow-xl p-3 text-xs text-notion-muted space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-notion-muted/80 mb-1">Что показывать</p>
                {configureEntries.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={prefs.show[key]}
                      onChange={() =>
                        setPrefs((p) => ({
                          ...p,
                          show: { ...p.show, [key]: !p.show[key] },
                        }))
                      }
                      className="rounded border-notion-border"
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!hidePeriod && prefs.show.period ? (
        <div className="mb-3">
          <p className="text-[11px] text-notion-muted/80 uppercase tracking-wide mb-2">Период</p>
          <div className="flex flex-wrap gap-2 items-center">
            {(
              [
                ['all', 'Все'],
                ['month', 'Месяц'],
                ['year', 'Год'],
              ]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, period: id }))}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  prefs.period === id
                    ? 'bg-violet-600/25 border-violet-500/50 text-white'
                    : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {prefs.period === 'month' ? (
            <p className="text-xs text-notion-muted mt-2">
              Сейчас: {format(monthCursor, 'LLLL yyyy', { locale: ru })} — переключите стрелками{' '}
              {embedded ? 'в шапке страницы.' : 'выше.'}
            </p>
          ) : null}
          {prefs.period === 'year' ? (
            <p className="text-xs text-notion-muted mt-2">
              Сейчас: {format(monthCursor, 'yyyy', { locale: ru })} — переключите стрелками{' '}
              {embedded ? 'в шапке страницы.' : 'выше.'}
            </p>
          ) : null}
        </div>
      ) : null}

      {prefs.show.status && statusItems.length > 0 ? (
        <div className="mb-3">
          <p className="text-[11px] text-notion-muted/80 uppercase tracking-wide mb-2">Статус</p>
          <div className="flex flex-wrap gap-1.5">
            {statusItems.map((it) => {
              const on = prefs.statusIds.includes(it.id);
              const cls = notionPillClasses(it.color || 'gray');
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, statusIds: toggleId(p.statusIds, it.id) }))}
                  className={`text-xs px-2 py-1 rounded-md border transition-all ${cls} ${
                    on ? 'ring-2 ring-violet-400/60 ring-offset-2 ring-offset-[#1e1e1e]' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-notion-muted/70 mt-1">Ничего не выбрано — все статусы.</p>
        </div>
      ) : null}

      {prefs.show.source && sourceItems.length > 0 ? (
        <div className="mb-3">
          <p className="text-[11px] text-notion-muted/80 uppercase tracking-wide mb-2">Источник</p>
          <div className="flex flex-wrap gap-1.5">
            {sourceItems.map((it) => {
              const on = prefs.sourceIds.includes(it.id);
              const cls = notionPillClasses(it.color || 'gray');
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, sourceIds: toggleId(p.sourceIds, it.id) }))}
                  className={`text-xs px-2 py-1 rounded-md border transition-all ${cls} ${
                    on ? 'ring-2 ring-violet-400/60 ring-offset-2 ring-offset-[#1e1e1e]' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-notion-muted/70 mt-1">Ничего не выбрано — все источники.</p>
        </div>
      ) : null}

      {prefs.show.tags && tagItems.length > 0 ? (
        <div className="mb-3">
          <p className="text-[11px] text-notion-muted/80 uppercase tracking-wide mb-2">Теги</p>
          <div className="flex flex-wrap gap-1.5">
            {tagItems.map((it) => {
              const on = prefs.tagIds.includes(it.id);
              const cls = notionPillClasses(it.color || 'gray');
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, tagIds: toggleId(p.tagIds, it.id) }))}
                  className={`text-xs px-2 py-1 rounded-md border transition-all ${cls} ${
                    on ? 'ring-2 ring-violet-400/60 ring-offset-2 ring-offset-[#1e1e1e]' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-notion-muted/70 mt-1">Запись подходит, если есть любой из выбранных тегов.</p>
        </div>
      ) : null}

      {prefs.show.search ? (
        <div>
          <p className="text-[11px] text-notion-muted/80 uppercase tracking-wide mb-2">Поиск</p>
          <input
            type="search"
            value={prefs.search}
            onChange={(e) => setPrefs((p) => ({ ...p, search: e.target.value }))}
            placeholder="Название или описание…"
            className="w-full max-w-md rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white placeholder:text-notion-muted/60"
          />
        </div>
      ) : null}
    </div>
  );
}

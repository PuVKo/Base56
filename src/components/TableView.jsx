import { useMemo } from 'react';
import { FloatingSidePanel } from '@/components/FloatingSidePanel';
import { TileFieldsPanel } from '@/components/TileFieldsPanel';
import { ViewFiltersPanel } from '@/components/ViewFiltersPanel';
import { tagById } from '@/data/constants';
import { normalizeClientFieldValue } from '@/lib/clientField';
import { formatRu7Progressive } from '@/lib/ruPhoneMask';
import { applyGalleryFilters, isGalleryPrefsActive } from '@/lib/galleryFilterPrefs';
import { defaultGalleryFilters } from '@/lib/galleryPrefsModel';
import { formatDateDdMmYyyy, formatRub } from '@/lib/format';
import { pillDisplayForField, tagPillFromFieldOrConstants } from '@/lib/fieldOptions';
import { TABLE_SLOT_ORDER, fieldForTableSlot, isTableSlotVisible } from '@/lib/tableViewSlots';

const SLOT_LABELS = {
  date: 'Дата',
  title: 'Название',
  time: 'Время',
  description: 'Описание',
  amount: 'Сумма',
  status: 'Статус',
  tags: 'Тэги',
  source: 'Источник',
  client: 'Клиент',
};

/**
 * Значение поля «Клиент» в записи: по ключу из схемы (`client` / `clientName`), иначе фиксированный `clientName`.
 * @param {Record<string, unknown>} b
 * @param {any | undefined} clientField
 */
function bookingClientRaw(b, clientField) {
  if (clientField?.key) {
    const v = b[clientField.key];
    if (v !== undefined && v !== null) return v;
  }
  return b.clientName;
}

/**
 * @param {object} props
 * @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} props.bookings — все записи; период задаётся фильтром (как в плитках)
 * @param {Date} props.monthCursor
 * @param {any[] | undefined} props.fields
 * @param {(id: string) => void} props.onOpenBooking
 * @param {import('@/lib/galleryPrefsModel').ClientUiPayload} props.clientUi
 * @param {(next: import('@/lib/galleryPrefsModel').ClientUiPayload | ((prev: import('@/lib/galleryPrefsModel').ClientUiPayload) => import('@/lib/galleryPrefsModel').ClientUiPayload)) => void} props.updateClientUi
 */
export function TableView({ bookings, monthCursor, fields, onOpenBooking, clientUi, updateClientUi }) {
  const prefs = clientUi.tableFilters;
  const tileVisible = clientUi.tableTileFieldVisible || {};
  const tagsField = fields?.find((f) => f.type === 'tags' || f.key === 'tagIds');

  /** @param {import('@/lib/galleryPrefsModel').GalleryFilterPrefs | ((p: import('@/lib/galleryPrefsModel').GalleryFilterPrefs) => import('@/lib/galleryPrefsModel').GalleryFilterPrefs)} nextOrFn */
  function setTableFilters(nextOrFn) {
    updateClientUi((prev) => ({
      ...prev,
      tableFilters: typeof nextOrFn === 'function' ? nextOrFn(prev.tableFilters) : nextOrFn,
    }));
  }

  const filtered = useMemo(
    () => applyGalleryFilters(bookings, prefs, monthCursor),
    [bookings, prefs, monthCursor],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.timeRange || '').localeCompare(b.timeRange || '');
      }),
    [filtered],
  );

  const hasFilters = isGalleryPrefsActive(prefs);

  function resetFilters() {
    updateClientUi((prev) => ({ ...prev, tableFilters: defaultGalleryFilters() }));
  }

  const visibleSlots = useMemo(() => {
    const v = TABLE_SLOT_ORDER.filter((slot) => isTableSlotVisible(slot, fields, tileVisible));
    return v.length > 0 ? v : TABLE_SLOT_ORDER;
  }, [fields, tileVisible]);

  const sum = sorted.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const colCount = visibleSlots.length;

  const clientSlotField = useMemo(() => fieldForTableSlot('client', fields), [fields]);

  return (
    <div className="space-y-4">
      <FloatingSidePanel
        open={clientUi.tableTileFieldsPanelOpen}
        onClose={() => updateClientUi((prev) => ({ ...prev, tableTileFieldsPanelOpen: false }))}
        title="Поля таблицы"
      >
        <TileFieldsPanel
          embedded
          fields={fields}
          tileVisible={tileVisible}
          title="Столбцы таблицы"
          description="Отметьте, какие поля показывать в строке. Порядок столбцов фиксированный."
          onToggleField={(fieldId, on) =>
            updateClientUi((prev) => ({
              ...prev,
              tableTileFieldVisible: {
                ...(prev.tableTileFieldVisible || {}),
                [fieldId]: on,
              },
            }))
          }
        />
      </FloatingSidePanel>

      <FloatingSidePanel
        open={clientUi.tableFiltersPanelOpen}
        onClose={() => updateClientUi((prev) => ({ ...prev, tableFiltersPanelOpen: false }))}
        title="Фильтры"
      >
        <ViewFiltersPanel
          embedded
          prefs={prefs}
          setPrefs={setTableFilters}
          monthCursor={monthCursor}
          fields={fields}
          hasFilters={hasFilters}
          onReset={resetFilters}
        />
      </FloatingSidePanel>

      <div className="rounded-lg sm:rounded-xl border border-notion-border bg-notion-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-notion-border text-left text-notion-muted text-[10px] sm:text-xs uppercase tracking-wide">
                {visibleSlots.map((slot) => (
                  <th
                    key={slot}
                    className={`px-2 sm:px-4 py-2 sm:py-3 font-medium ${
                      slot === 'title'
                        ? 'min-w-[140px] sm:min-w-[160px]'
                        : slot === 'description'
                          ? 'min-w-[160px] sm:min-w-[200px]'
                          : slot === 'client'
                            ? 'min-w-[140px] sm:min-w-[200px]'
                            : slot === 'amount'
                              ? 'whitespace-nowrap text-right'
                              : 'whitespace-nowrap'
                    }`}
                  >
                    {SLOT_LABELS[slot]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(colCount, 1)} className="px-3 sm:px-4 py-10 text-center text-notion-muted">
                    {bookings.length === 0
                      ? 'Пока нет записей.'
                      : hasFilters
                        ? 'Нет записей по выбранным фильтрам.'
                        : 'Нет записей для отображения.'}
                  </td>
                </tr>
              ) : (
                sorted.map((b) => {
                  const status = pillDisplayForField(fields, 'status', b.status);
                  const src = pillDisplayForField(fields, 'sourceId', b.sourceId);
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-notion-border/60 hover:bg-notion-hover/40 cursor-pointer transition-colors"
                      onClick={() => onOpenBooking(b.id)}
                    >
                      {visibleSlots.map((slot) => {
                        if (slot === 'date') {
                          return (
                            <td
                              key={slot}
                              className="px-2 sm:px-4 py-2 sm:py-2.5 text-notion-muted whitespace-nowrap tabular-nums"
                            >
                              {formatDateDdMmYyyy(b.date)}
                            </td>
                          );
                        }
                        if (slot === 'title') {
                          return (
                            <td
                              key={slot}
                              className="px-2 sm:px-4 py-2 sm:py-2.5 text-white font-medium max-w-[12rem] sm:max-w-none truncate sm:whitespace-normal"
                            >
                              {b.title || '—'}
                            </td>
                          );
                        }
                        if (slot === 'time') {
                          return (
                            <td key={slot} className="px-2 sm:px-4 py-2 sm:py-2.5 text-notion-muted whitespace-nowrap">
                              {b.timeRange || '—'}
                            </td>
                          );
                        }
                        if (slot === 'description') {
                          return (
                            <td
                              key={slot}
                              className="px-2 sm:px-4 py-2 sm:py-2.5 text-notion-muted max-w-[10rem] sm:max-w-xs truncate"
                            >
                              {b.description || '—'}
                            </td>
                          );
                        }
                        if (slot === 'amount') {
                          return (
                            <td
                              key={slot}
                              className="px-2 sm:px-4 py-2 sm:py-2.5 text-right text-emerald-200/90 font-medium tabular-nums whitespace-nowrap"
                            >
                              {formatRub(b.amount)}
                            </td>
                          );
                        }
                        if (slot === 'status') {
                          return (
                            <td key={slot} className="px-2 sm:px-4 py-2 sm:py-2.5">
                              <span
                                className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md inline-block whitespace-nowrap ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </td>
                          );
                        }
                        if (slot === 'tags') {
                          return (
                            <td key={slot} className="px-2 sm:px-4 py-2 sm:py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {b.tagIds.map((tid) => {
                                  const pill = tagPillFromFieldOrConstants(tagsField, tid);
                                  if (pill) {
                                    return (
                                      <span
                                        key={tid}
                                        className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md ${pill.className}`}
                                      >
                                        {pill.label}
                                      </span>
                                    );
                                  }
                                  const tg = tagById(tid);
                                  if (!tg) return null;
                                  return (
                                    <span
                                      key={tid}
                                      className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md ${tg.className}`}
                                    >
                                      {tg.label}
                                    </span>
                                  );
                                })}
                                {!b.tagIds.length ? '—' : null}
                              </div>
                            </td>
                          );
                        }
                        if (slot === 'source') {
                          return (
                            <td key={slot} className="px-2 sm:px-4 py-2 sm:py-2.5">
                              {src.label ? (
                                <span
                                  className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md inline-block ${src.className}`}
                                >
                                  {src.label}
                                </span>
                              ) : null}
                            </td>
                          );
                        }
                        if (slot === 'client') {
                          const { name, phone } = normalizeClientFieldValue(
                            bookingClientRaw(/** @type {Record<string, unknown>} */ (b), clientSlotField),
                          );
                          const phoneLine = phone ? formatRu7Progressive(phone) : '';
                          const empty = !name.trim() && !phoneLine;
                          return (
                            <td
                              key={slot}
                              className="px-2 sm:px-4 py-2 sm:py-2.5 max-w-[14rem] sm:max-w-[18rem] align-top"
                            >
                              {empty ? (
                                <span className="text-notion-muted">—</span>
                              ) : (
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  {name.trim() ? (
                                    <span className="text-white/90 font-medium leading-snug break-words">{name.trim()}</span>
                                  ) : null}
                                  {phoneLine ? (
                                    <span className="text-notion-muted text-[11px] sm:text-xs tabular-nums leading-snug">
                                      {phoneLine}
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          );
                        }
                        return null;
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
            {sorted.length > 0 && colCount > 0 ? (
              <tfoot>
                <tr className="bg-notion-bg/90 border-t border-notion-border">
                  <td colSpan={colCount} className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs">
                      <span className="text-notion-muted font-medium">Итого ({sorted.length})</span>
                      <span className="text-emerald-200 font-semibold tabular-nums">{formatRub(sum)}</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}

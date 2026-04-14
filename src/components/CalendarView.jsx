import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import { FloatingSidePanel } from '@/components/FloatingSidePanel';
import { GalleryTileBookingContent } from '@/components/GalleryTileBookingContent';
import { TileFieldsPanel } from '@/components/TileFieldsPanel';
import { ViewFiltersPanel } from '@/components/ViewFiltersPanel';
import { applyGalleryFilters, isViewFiltersActive } from '@/lib/galleryFilterPrefs';
import { defaultGalleryFilters } from '@/lib/galleryPrefsModel';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/**
 * @param {object} props
 * @param {Date} props.monthCursor
 * @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} props.bookings
 * @param {any[] | undefined} props.fields
 * @param {(id: string) => void} props.onOpenBooking
 * @param {(date: string) => void} props.onCreateOnDate
 * @param {(id: string, nextDate: string) => void} props.onMoveBooking
 * @param {import('@/lib/galleryPrefsModel').ClientUiPayload} props.clientUi
 * @param {(next: import('@/lib/galleryPrefsModel').ClientUiPayload | ((prev: import('@/lib/galleryPrefsModel').ClientUiPayload) => import('@/lib/galleryPrefsModel').ClientUiPayload)) => void} props.updateClientUi
 */
export function CalendarView({
  monthCursor,
  bookings,
  fields,
  onOpenBooking,
  onCreateOnDate,
  onMoveBooking,
  clientUi,
  updateClientUi,
}) {
  const prefs = clientUi.calendarFilters;
  const tileVisible = clientUi.calendarTileFieldVisible || {};

  /** @param {import('@/lib/galleryPrefsModel').GalleryFilterPrefs | ((p: import('@/lib/galleryPrefsModel').GalleryFilterPrefs) => import('@/lib/galleryPrefsModel').GalleryFilterPrefs)} nextOrFn */
  function setCalendarFilters(nextOrFn) {
    updateClientUi((prev) => ({
      ...prev,
      calendarFilters:
        typeof nextOrFn === 'function' ? nextOrFn(prev.calendarFilters) : nextOrFn,
    }));
  }

  const filteredBookings = useMemo(
    () => applyGalleryFilters(bookings, prefs, monthCursor, { calendarView: true }),
    [bookings, prefs, monthCursor],
  );

  const hasFilters = isViewFiltersActive(prefs, { includePeriod: false });

  function resetFilters() {
    updateClientUi((prev) => ({ ...prev, calendarFilters: defaultGalleryFilters() }));
  }

  const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const [dragOverIso, setDragOverIso] = useState('');
  const draggingRef = useRef(false);

  const bookingsByDate = useMemo(() => {
    /** @type {Map<string, typeof filteredBookings>} */
    const m = new Map();
    for (const b of filteredBookings) {
      const d = typeof b.date === 'string' ? b.date : '';
      if (!d) continue;
      const arr = m.get(d);
      if (arr) arr.push(b);
      else m.set(d, [b]);
    }
    return m;
  }, [filteredBookings]);

  return (
    <div className="space-y-4">
      <FloatingSidePanel
        open={clientUi.calendarTileFieldsPanelOpen}
        onClose={() => updateClientUi((prev) => ({ ...prev, calendarTileFieldsPanelOpen: false }))}
        title="Поля карточки"
      >
        <TileFieldsPanel
          embedded
          fields={fields}
          tileVisible={tileVisible}
          title="Поля на карточке"
          description="Что показывать в ячейке дня. Порядок как в форме заказа."
          onToggleField={(fieldId, on) =>
            updateClientUi((prev) => ({
              ...prev,
              calendarTileFieldVisible: {
                ...(prev.calendarTileFieldVisible || {}),
                [fieldId]: on,
              },
            }))
          }
        />
      </FloatingSidePanel>

      <FloatingSidePanel
        open={clientUi.calendarFiltersPanelOpen}
        onClose={() => updateClientUi((prev) => ({ ...prev, calendarFiltersPanelOpen: false }))}
        title="Фильтры"
      >
        <ViewFiltersPanel
          embedded
          prefs={prefs}
          setPrefs={setCalendarFilters}
          monthCursor={monthCursor}
          fields={fields}
          hidePeriod
          hasFilters={hasFilters}
          onReset={resetFilters}
        />
      </FloatingSidePanel>

      <div className="rounded-lg sm:rounded-xl border border-notion-border bg-notion-surface overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
          <div className="min-w-[40rem] sm:min-w-0">
            <div className="grid grid-cols-7 border-b border-notion-border bg-notion-bg/80">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-1 py-2 sm:px-2 sm:py-2.5 text-center text-[11px] sm:text-xs font-medium text-notion-muted uppercase tracking-wide"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-auto">
              {days.map((day) => {
                const iso = format(day, 'yyyy-MM-dd');
                const inMonth = isSameMonth(day, monthCursor);
                const dayBookings = bookingsByDate.get(iso) ?? [];
                return (
                  <div
                    key={iso}
                    onDragOver={(e) => {
                      if (draggingRef.current) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDragEnter={() => draggingRef.current && setDragOverIso(iso)}
                    onDragLeave={() => draggingRef.current && setDragOverIso((cur) => (cur === iso ? '' : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/plain');
                      setDragOverIso('');
                      draggingRef.current = false;
                      if (id) onMoveBooking(id, iso);
                    }}
                    className={`group min-h-[104px] sm:min-h-[132px] border-b border-r border-notion-border/80 p-1 sm:p-1.5 flex flex-col gap-1 transition-[background,opacity] ${
                      inMonth
                        ? 'bg-notion-surface'
                        : 'bg-notion-bg/95 opacity-[0.72] saturate-[0.65]'
                    } ${isToday(day) ? (inMonth ? 'ring-1 ring-inset ring-violet-500/40' : 'ring-1 ring-inset ring-violet-500/20') : ''} ${
                      dragOverIso === iso ? 'ring-2 ring-inset ring-emerald-400/35 bg-emerald-950/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between px-0.5 shrink-0">
                      <span
                        className={`text-xs sm:text-sm font-semibold tabular-nums ${
                          inMonth
                            ? isToday(day)
                              ? 'text-violet-300'
                              : 'text-white'
                            : isToday(day)
                              ? 'text-violet-400/45'
                              : 'text-notion-muted/40'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      <button
                        type="button"
                        onClick={() => onCreateOnDate(iso)}
                        className={`text-xs w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center rounded-md hover:bg-notion-hover touch-manipulation opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 ${
                          inMonth
                            ? 'text-notion-muted hover:text-white'
                            : 'text-notion-muted/35 hover:text-notion-muted/70'
                        }`}
                        title="Новая запись"
                      >
                        +
                      </button>
                    </div>
                    <div
                      className={`flex flex-col gap-1 w-full min-w-0 ${inMonth ? '' : 'opacity-80'}`}
                    >
                      {dayBookings.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            draggingRef.current = true;
                            setDragOverIso('');
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', b.id);
                          }}
                          onDragEnd={() => {
                            setDragOverIso('');
                            setTimeout(() => {
                              draggingRef.current = false;
                            }, 0);
                          }}
                          onClick={() => {
                            if (draggingRef.current) return;
                            onOpenBooking(b.id);
                          }}
                          className={`text-left rounded-lg px-1.5 py-1.5 sm:px-2 sm:py-2 border transition-colors touch-manipulation h-auto min-h-0 flex flex-col ${
                            inMonth
                              ? 'bg-notion-hover/60 active:bg-notion-hover border-notion-border/50'
                              : 'bg-notion-bg/60 active:bg-notion-hover/40 border-notion-border/35'
                          }`}
                        >
                          <GalleryTileBookingContent
                            booking={/** @type {Record<string, unknown>} */ (b)}
                            fields={fields}
                            galleryTileFieldVisible={tileVisible}
                            compact
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

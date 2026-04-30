import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FloatingSidePanel } from '@/components/FloatingSidePanel';
import { GalleryTileBookingContent } from '@/components/GalleryTileBookingContent';
import { TileFieldsPanel } from '@/components/TileFieldsPanel';
import { ViewFiltersPanel } from '@/components/ViewFiltersPanel';
import { useCoarsePointer, useIsMobile } from '@/hooks/use-mobile';
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
 * @param {(d: Date) => void} [props.onMonthForDayChange] — синхронизация месяца при листании дня в панели
 * @param {import('@/lib/galleryPrefsModel').ClientUiPayload} props.clientUi
 * @param {(next: import('@/lib/galleryPrefsModel').ClientUiPayload | ((prev: import('@/lib/galleryPrefsModel').ClientUiPayload) => import('@/lib/galleryPrefsModel').ClientUiPayload)) => void} props.updateClientUi
 */
export function CalendarView({
  monthCursor,
  bookings,
  fields,
  onOpenBooking,
  onCreateOnDate,
  onMonthForDayChange,
  onMoveBooking,
  clientUi,
  updateClientUi,
}) {
  const prefs = clientUi.calendarFilters;
  const tileVisible = clientUi.calendarTileFieldVisible || {};
  const isMobile = useIsMobile();
  const coarsePointer = useCoarsePointer();
  const dndEnabled = !coarsePointer;

  /** @param {import('@/lib/galleryPrefsModel').GalleryFilterPrefs | ((p: import('@/lib/galleryPrefsModel').GalleryFilterPrefs) => import('@/lib/galleryPrefsModel').GalleryFilterPrefs)} nextOrFn */
  function setCalendarFilters(nextOrFn) {
    updateClientUi((prev) => ({
      ...prev,
      calendarFilters:
        typeof nextOrFn === 'function' ? nextOrFn(prev.calendarFilters) : nextOrFn,
    }));
  }

  const filteredBookings = useMemo(() => {
    // В сетке месяца показываем дни из соседних месяцев (padding),
    // поэтому фильтр по периоду делаем по интервалу сетки, а не строго по monthCursor.
    const base = applyGalleryFilters(bookings, prefs, monthCursor, { skipPeriod: true });
    const start = format(startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return base.filter((b) => {
      const d = typeof b.date === 'string' ? b.date : '';
      if (!d) return false;
      return d >= start && d <= end;
    });
  }, [bookings, prefs, monthCursor]);

  const hasFilters = isViewFiltersActive(prefs, { includePeriod: false });

  function resetFilters() {
    updateClientUi((prev) => ({ ...prev, calendarFilters: defaultGalleryFilters() }));
  }

  const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const [dragOverIso, setDragOverIso] = useState('');
  const draggingRef = useRef(false);
  const [daySheetIso, setDaySheetIso] = useState(/** @type {string | null} */ (null));

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

  const syncMonthIfNeeded = useCallback(
    (iso) => {
      const d = new Date(iso + 'T12:00:00');
      if (
        d.getMonth() !== monthCursor.getMonth() ||
        d.getFullYear() !== monthCursor.getFullYear()
      ) {
        onMonthForDayChange?.(d);
      }
    },
    [monthCursor, onMonthForDayChange],
  );

  /**
   * @param {string} iso
   * @param {boolean} [syncMonthWithDay] — если false (дни padding соседнего месяца), не трогаем monthCursor
   */
  const openDaySheet = useCallback(
    (iso, syncMonthWithDay = true) => {
      setDaySheetIso(iso);
      if (syncMonthWithDay) syncMonthIfNeeded(iso);
    },
    [syncMonthIfNeeded],
  );

  const shiftDayIso = useCallback((iso, deltaDays) => {
    const base = new Date(iso + 'T12:00:00');
    return format(addDays(base, deltaDays), 'yyyy-MM-dd');
  }, []);

  const goAdjacentDay = useCallback(
    (delta) => {
      if (!daySheetIso) return;
      const next = shiftDayIso(daySheetIso, delta);
      setDaySheetIso(next);
      syncMonthIfNeeded(next);
    },
    [daySheetIso, shiftDayIso, syncMonthIfNeeded],
  );

  /**
   * @param {typeof filteredBookings[0]} b
   * @param {boolean} inMonth
   * @param {{ onOpen?: () => void }} [opts]
   */
  function renderBookingButton(b, inMonth, opts) {
    const open = opts?.onOpen ?? (() => onOpenBooking(b.id));
    return (
      <button
        key={b.id}
        type="button"
        draggable={dndEnabled}
        onDragStart={
          dndEnabled
            ? (e) => {
                draggingRef.current = true;
                setDragOverIso('');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', b.id);
              }
            : undefined
        }
        onDragEnd={
          dndEnabled
            ? () => {
                setDragOverIso('');
                setTimeout(() => {
                  draggingRef.current = false;
                }, 0);
              }
            : undefined
        }
        onClick={() => {
          if (draggingRef.current) return;
          open();
        }}
        className={`text-left rounded-lg px-1.5 py-1.5 sm:px-2 sm:py-2 border transition-colors touch-manipulation h-auto min-h-0 w-full min-w-0 flex flex-col ${
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
    );
  }

  /** Десктоп: карточки в ячейке, DnD */
  function renderDesktopMonthCell(day) {
    const iso = format(day, 'yyyy-MM-dd');
    const inMonth = isSameMonth(day, monthCursor);
    const dayBookings = bookingsByDate.get(iso) ?? [];
    const dropHandlers =
      dndEnabled
        ? {
            onDragOver: (e) => {
              if (draggingRef.current) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            },
            onDragEnter: () => draggingRef.current && setDragOverIso(iso),
            onDragLeave: () =>
              draggingRef.current && setDragOverIso((cur) => (cur === iso ? '' : cur)),
            onDrop: (e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              setDragOverIso('');
              draggingRef.current = false;
              if (id) onMoveBooking(id, iso);
            },
          }
        : {};

    return (
      <div
        key={iso}
        {...dropHandlers}
        className={`group min-h-[104px] sm:min-h-[132px] border-b border-r border-notion-border/80 p-1 sm:p-1.5 flex flex-col gap-1 transition-[background,opacity] ${
          inMonth
            ? 'bg-notion-surface'
            : 'bg-notion-bg/95 opacity-[0.72] saturate-[0.65]'
        } ${isToday(day) ? (inMonth ? 'ring-1 ring-inset ring-violet-500/40' : 'ring-1 ring-inset ring-violet-500/20') : ''} ${
          dragOverIso === iso ? 'ring-2 ring-inset ring-emerald-400/35 bg-emerald-950/10' : ''
        }`}
      >
        <div className="flex items-center justify-between px-0.5 shrink-0">
          <button
            type="button"
            onClick={() => openDaySheet(iso, inMonth)}
            className={`text-left text-xs sm:text-sm font-semibold tabular-nums rounded px-0.5 -mx-0.5 touch-manipulation hover:bg-notion-hover/50 ${
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
          </button>
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
        <div className={`flex flex-col gap-1 w-full min-w-0 ${inMonth ? '' : 'opacity-80'}`}>
          {dayBookings.map((b) => renderBookingButton(b, inMonth))}
        </div>
      </div>
    );
  }

  /** Мобилка: число + точка, без карточек */
  function renderMobileMonthCell(day) {
    const iso = format(day, 'yyyy-MM-dd');
    const inMonth = isSameMonth(day, monthCursor);
    const dayBookings = bookingsByDate.get(iso) ?? [];
    const hasBookings = dayBookings.length > 0;
    const today = isToday(day);

    return (
      <button
        key={iso}
        type="button"
        onClick={() => openDaySheet(iso, inMonth)}
        className={`flex min-h-[3.25rem] flex-col items-center justify-start gap-0.5 border-b border-notion-border/50 py-1.5 touch-manipulation transition-colors ${
          inMonth ? 'bg-notion-surface' : 'bg-notion-bg/95 opacity-[0.72] saturate-[0.65]'
        } active:bg-notion-hover/30`}
      >
        <span
          className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
            today && inMonth
              ? 'bg-rose-600 text-white'
              : today && !inMonth
                ? 'bg-rose-600/40 text-white/90'
                : inMonth
                  ? 'text-white'
                  : 'text-notion-muted/45'
          }`}
        >
          {format(day, 'd')}
        </span>
        <span className="flex h-1.5 w-1.5 shrink-0 items-center justify-center" aria-hidden>
          {hasBookings ? (
            <span className="h-1.5 w-1.5 rounded-full bg-notion-muted/70" />
          ) : (
            <span className="h-1.5 w-1.5" />
          )}
        </span>
      </button>
    );
  }

  const daySheetBookings = daySheetIso ? (bookingsByDate.get(daySheetIso) ?? []) : [];
  const daySheetDate = daySheetIso ? new Date(daySheetIso + 'T12:00:00') : null;
  const daySheetTitle = daySheetDate ? format(daySheetDate, 'd MMMM', { locale: ru }) : 'День';

  const dayPanelHeader = daySheetIso ? (
    <div className="flex items-center gap-1 px-2 py-3 sm:px-4">
      <button
        type="button"
        onClick={() => goAdjacentDay(-1)}
        className="shrink-0 rounded-lg border border-notion-border p-2 text-notion-muted hover:bg-notion-hover hover:text-white"
        aria-label="Предыдущий день"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <h2
        id="floating-side-panel-title"
        className="min-w-0 flex-1 text-center text-base font-semibold capitalize text-white"
      >
        {daySheetTitle}
      </h2>
      <button
        type="button"
        onClick={() => goAdjacentDay(1)}
        className="shrink-0 rounded-lg border border-notion-border p-2 text-notion-muted hover:bg-notion-hover hover:text-white"
        aria-label="Следующий день"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setDaySheetIso(null)}
        className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-violet-200 hover:bg-notion-hover hover:text-white md:hidden"
      >
        Готово
      </button>
      <button
        type="button"
        onClick={() => setDaySheetIso(null)}
        className="hidden md:inline-flex shrink-0 items-center justify-center rounded-lg border border-notion-border p-2 text-notion-muted hover:bg-notion-hover hover:text-white"
        aria-label="Закрыть"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <FloatingSidePanel
        open={Boolean(daySheetIso)}
        onClose={() => setDaySheetIso(null)}
        header={dayPanelHeader}
        panelClassName="max-md:max-w-full"
      >
        {daySheetIso ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onCreateOnDate(daySheetIso)}
              className="w-full py-2.5 rounded-lg border border-notion-border text-sm font-medium text-white hover:bg-notion-hover touch-manipulation"
            >
              + Новая запись на этот день
            </button>
            {daySheetBookings.length === 0 ? (
              <p className="text-sm text-notion-muted">Нет записей</p>
            ) : (
              <ul className="space-y-2">
                {daySheetBookings.map((b) => (
                  <li key={b.id}>
                    {renderBookingButton(b, true, {
                      onOpen: () => {
                        setDaySheetIso(null);
                        onOpenBooking(b.id);
                      },
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </FloatingSidePanel>

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
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-b border-notion-border bg-notion-bg/80">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className={`text-center font-medium uppercase text-notion-muted ${
                  isMobile
                    ? 'px-0 py-2 text-[10px] leading-tight tracking-tight'
                    : 'px-1 py-2 sm:px-2 sm:py-2.5 text-[11px] sm:text-xs tracking-wide'
                }`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-auto">
            {days.map((day) =>
              isMobile ? renderMobileMonthCell(day) : renderDesktopMonthCell(day),
            )}
          </div>
        </div>
        {!isMobile && !dndEnabled ? (
          <p className="text-[11px] text-notion-muted/90 px-3 py-2 border-t border-notion-border/80">
            Перенос между днями: откройте запись и смените дату (на телефоне перетаскивание отключено).
          </p>
        ) : null}
      </div>
    </div>
  );
}

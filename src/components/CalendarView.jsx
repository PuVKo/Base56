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
import {
  BookingSourceChip,
  BookingStatusChip,
  BookingTagChips,
  mapBookingStatusToMockup,
} from '@/components/MockupChips.jsx';
import { FloatingSidePanel } from '@/components/FloatingSidePanel';
import { TileFieldsPanel } from '@/components/TileFieldsPanel';
import { ViewFiltersPanel } from '@/components/ViewFiltersPanel';
import { useCoarsePointer, useIsMobile } from '@/hooks/use-mobile';
import { applyGalleryFilters, isViewFiltersActive } from '@/lib/galleryFilterPrefs';
import { defaultGalleryFilters } from '@/lib/galleryPrefsModel';
import { formatRub } from '@/lib/format';

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
    const st = mapBookingStatusToMockup(b.status);
    const dateShort = typeof b.date === 'string' ? b.date.slice(8, 10) : '';
    const monthShort = typeof b.date === 'string' ? b.date.slice(5, 7) : '';
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
        className={`cal-event status-${st} text-left w-full min-w-0 font-inherit ${
          inMonth ? '' : 'opacity-90'
        }`}
      >
        <div className="cal-event-title">{b.title || 'Без названия'}</div>
        <div className="cal-event-time">
          {dateShort}.{monthShort} · {b.timeRange || '—'}
        </div>
        {b.description ? (
          <div className="cal-event-desc">{b.description}</div>
        ) : null}
        <div className="cal-event-tags">
          <BookingStatusChip fields={fields} status={b.status} />
          <BookingTagChips fields={fields} tagIds={b.tagIds || []} />
          <BookingSourceChip fields={fields} sourceId={b.sourceId} />
        </div>
        {b.amount > 0 ? <div className="cal-event-amount">{formatRub(b.amount)}</div> : null}
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
        className={`cal-cell group ${!inMonth ? 'other-month' : ''} ${isToday(day) ? 'today' : ''} min-h-[104px] sm:min-h-[132px] transition-[background,opacity] ${
          dragOverIso === iso ? 'ring-2 ring-inset ring-[color:var(--accent)]/40 !bg-[var(--accent-soft)]' : ''
        }`}
      >
        <div className="flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => openDaySheet(iso, inMonth)}
            className={`cal-num text-left font-semibold tabular-nums rounded px-0.5 -mx-0.5 touch-manipulation hover:bg-[var(--surface-hover)] ${
              inMonth ? '' : 'opacity-70'
            }`}
          >
            {format(day, 'd')}
          </button>
          <button
            type="button"
            onClick={() => onCreateOnDate(iso)}
            className={`icon-btn text-xs w-6 h-6 sm:w-7 sm:h-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 ${
              inMonth ? '' : 'opacity-60'
            }`}
            title="Новая запись"
          >
            +
          </button>
        </div>
        <div className={`flex flex-col gap-1 w-full min-w-0 flex-1 ${inMonth ? '' : 'opacity-80'}`}>
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
    const today = isToday(day);

    return (
      <button
        key={iso}
        type="button"
        onClick={() => openDaySheet(iso, inMonth)}
        className={`cal-cell cal-cell-mobile !flex flex-col items-center justify-start gap-0 touch-manipulation font-inherit transition-colors focus-visible:outline-none ${
          !inMonth ? 'other-month' : ''
        } ${today ? 'today' : ''}`}
      >
        <span className={`cal-num ${today ? '' : ''}`}>{format(day, 'd')}</span>
        <span className="cal-mobile-dot-row" aria-hidden>
          {dayBookings.length > 0 ? (
            <span className="cal-mobile-booking-dot" />
          ) : (
            <span className="cal-mobile-dot-placeholder" />
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
        className="shrink-0 rounded-lg border border-notion-border p-2 text-notion-muted hover:bg-notion-hover hover:text-notion-fg"
        aria-label="Предыдущий день"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <h2
        id="floating-side-panel-title"
        className="min-w-0 flex-1 text-center text-base font-semibold capitalize text-notion-fg"
      >
        {daySheetTitle}
      </h2>
      <button
        type="button"
        onClick={() => goAdjacentDay(1)}
        className="shrink-0 rounded-lg border border-notion-border p-2 text-notion-muted hover:bg-notion-hover hover:text-notion-fg"
        aria-label="Следующий день"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setDaySheetIso(null)}
        className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-brand hover:bg-notion-hover hover:text-notion-fg md:hidden"
      >
        Готово
      </button>
      <button
        type="button"
        onClick={() => setDaySheetIso(null)}
        className="hidden md:inline-flex shrink-0 items-center justify-center rounded-lg border border-notion-border p-2 text-notion-muted hover:bg-notion-hover hover:text-notion-fg"
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
              className="w-full py-2.5 rounded-lg border border-notion-border text-sm font-medium text-notion-fg hover:bg-notion-hover touch-manipulation"
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

      <div className="content min-h-0 flex flex-col">
        <div className={`cal-grid min-w-0 flex-1${isMobile ? ' cal-grid--mobile-month' : ''}`}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-head">
              {d}
            </div>
          ))}
          {days.map((day) => (isMobile ? renderMobileMonthCell(day) : renderDesktopMonthCell(day)))}
        </div>
        {!isMobile && !dndEnabled ? (
          <p className="text-[11px] muted px-1 py-2 border-t border-[color:var(--border)]">
            Перенос между днями: откройте запись и смените дату (на телефоне перетаскивание отключено).
          </p>
        ) : null}
      </div>
    </div>
  );
}

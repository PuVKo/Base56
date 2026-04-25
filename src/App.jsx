import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, addYears, format, startOfMonth, startOfYear } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarRange,
  LayoutTemplate,
  ListFilter,
  MoreVertical,
  PanelLeft,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { AssistantView } from '@/components/AssistantView';
import { BookingModal } from '@/components/BookingModal';
import { CalendarView } from '@/components/CalendarView';
import { DashboardPeriodPanelContent } from '@/components/DashboardPeriodPanel';
import { DashboardView } from '@/components/DashboardView';
import { FloatingSidePanel } from '@/components/FloatingSidePanel';
import { GalleryView } from '@/components/GalleryView';
import { MobileNav } from '@/components/MobileNav';
import { MonthNav } from '@/components/MonthNav';
import { YearNav } from '@/components/YearNav';
import { SettingsView } from '@/components/SettingsView';
import { Sidebar } from '@/components/Sidebar';
import { TableView } from '@/components/TableView';
import { useBookingsAndFields } from '@/hooks/useBookingsAndFields';
import { filterByMonth } from '@/lib/bookingUtils';
import { createEmptyBooking } from '@/lib/emptyBooking';
import { formatRub } from '@/lib/format';
import { isGalleryPrefsActive, isViewFiltersActive } from '@/lib/galleryFilterPrefs';

const SIDEBAR_KEY = 'base56-sidebar-open';
const LEGACY_SIDEBAR_KEY = 'photocrm-sidebar-open';

function readSidebarOpen() {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    if (v !== null) return v !== '0';
    const legacy = localStorage.getItem(LEGACY_SIDEBAR_KEY);
    if (legacy !== null) return legacy !== '0';
    return true;
  } catch {
    return true;
  }
}

function pluralRecordsRu(n) {
  const m = n % 100;
  if (m >= 11 && m <= 14) return 'записей';
  const d = n % 10;
  if (d === 1) return 'запись';
  if (d >= 2 && d <= 4) return 'записи';
  return 'записей';
}

/**
 * @param {object} [props]
 * @param {{ id: string, email: string, login?: string | null, emailVerified?: boolean } | null} [props.currentUser]
 */
export default function App({ currentUser = null }) {
  const {
    bookings,
    fields,
    clientUi,
    updateClientUi,
    refreshClientUi,
    ready,
    error,
    refreshFields,
    refreshBookings,
    saveBooking,
    removeBooking,
    applyBookingLocal,
    flushNow,
    hasPendingWork,
    syncError,
    clearSyncError,
    patchFieldLocal,
    createFieldLocal,
    deleteFieldLocal,
    reorderFieldsLocal,
  } = useBookingsAndFields();
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [activeView, setActiveView] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBooking, setModalBooking] = useState(null);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => readSidebarOpen());
  const [settingsTab, setSettingsTab] = useState(/** @type {'profile' | 'fields'} */ ('fields'));
  const [toast, setToast] = useState('');
  const [calendarMobileMenuOpen, setCalendarMobileMenuOpen] = useState(false);
  const calendarMobileMenuRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    if (!calendarMobileMenuOpen) return;
    function onDoc(/** @type {MouseEvent | TouchEvent} */ e) {
      const el = calendarMobileMenuRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setCalendarMobileMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [calendarMobileMenuOpen]);

  function setMainView(/** @type {string} */ view) {
    setActiveView(view);
    if (view === 'settings') setSettingsTab('fields');
  }

  function openProfileSettings() {
    setActiveView('settings');
    setSettingsTab('profile');
  }

  const galleryPeriodMode = clientUi.galleryFilters.period;
  const tablePeriodMode = clientUi.tableFilters.period;
  const galleryFiltersOpen = clientUi.galleryFiltersPanelOpen;
  const galleryTileFieldsOpen = clientUi.galleryTileFieldsPanelOpen;
  const galleryFiltersActiveHint = isGalleryPrefsActive(clientUi.galleryFilters);

  const calendarFiltersOpen = clientUi.calendarFiltersPanelOpen;
  const calendarTileFieldsOpen = clientUi.calendarTileFieldsPanelOpen;
  const calendarFiltersActiveHint = isViewFiltersActive(clientUi.calendarFilters, { includePeriod: false });

  const tableFiltersOpen = clientUi.tableFiltersPanelOpen;
  const tableTileFieldsOpen = clientUi.tableTileFieldsPanelOpen;
  const tableFiltersActiveHint = isGalleryPrefsActive(clientUi.tableFilters);

  const dashboardPeriod = clientUi.dashboardPeriod;
  const dashboardPeriodPanelOpen = clientUi.dashboardPeriodPanelOpen;
  const dashboardSubtitle = useMemo(() => {
    if (dashboardPeriod === 'all') return 'Всё время';
    if (dashboardPeriod === 'year') return `${format(monthCursor, 'yyyy', { locale: ru })} год`;
    return format(monthCursor, 'LLLL yyyy', { locale: ru });
  }, [dashboardPeriod, monthCursor]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, desktopSidebarOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [desktopSidebarOpen]);

  useEffect(() => {
    if (activeView === 'dashboard') return;
    updateClientUi((prev) =>
      prev.dashboardPeriodPanelOpen ? { ...prev, dashboardPeriodPanelOpen: false } : prev,
    );
  }, [activeView, updateClientUi]);

  const monthBookings = useMemo(
    () => filterByMonth(bookings, monthCursor),
    [bookings, monthCursor],
  );

  const monthTotalRub = useMemo(
    () => monthBookings.reduce((acc, b) => acc + (Number(b.amount) || 0), 0),
    [monthBookings],
  );

  function openNew(dateIso) {
    const draft = createEmptyBooking(dateIso, fields);
    applyBookingLocal(draft);
    setModalBooking(draft);
    setModalOpen(true);
  }

  function openEdit(id) {
    const b = bookings.find((x) => x.id === id);
    if (b) {
      setModalBooking(b);
      setModalOpen(true);
    }
  }

  /**
   * @param {Record<string, unknown>} draft
   * @param {{ silent?: boolean }} [_opts]
   */
  async function handleSave(draft, _opts = {}) {
    try {
      await saveBooking(draft, false, {});
      setToast('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(msg);
      throw e;
    }
  }

  async function handleDelete(id) {
    try {
      await removeBooking(id);
      setToast('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(msg);
      throw e;
    }
  }

  const handleFlushSync = useCallback(() => flushNow(), [flushNow]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') void flushNow();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [flushNow]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (hasPendingWork()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasPendingWork]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-notion-bg text-notion-muted">
        Загрузка…
      </div>
    );
  }

  if (error) {
    const errText = String(error.message ?? '');
    const looksLikeNetwork =
      /failed to fetch|networkerror|load failed|econnrefused|connection refused|cors/i.test(errText);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-notion-bg text-notion-muted px-6 text-center max-w-lg mx-auto">
        <p className="text-white font-medium mb-2">Не удалось связаться с API</p>
        {looksLikeNetwork ? (
          <p className="text-sm mb-4 text-left w-full">
            Чаще всего не запущен сервер на порту <span className="text-notion-muted">3001</span> или открыт не тот
            адрес фронта. Запустите из корня проекта <span className="text-notion-muted">npm run dev</span> и откройте{' '}
            <span className="text-notion-muted">http://localhost:5174</span> — запросы{' '}
            <span className="text-notion-muted">/api</span> проксируются на бэкенд.
          </p>
        ) : (
          <p className="text-sm mb-4 text-left w-full">
            Если это ошибка базы: в <span className="text-notion-muted">server/.env</span> проверьте{' '}
            <span className="text-notion-muted">DATABASE_URL</span>. Локально обычно достаточно SQLite:{' '}
            <span className="text-notion-muted">DATABASE_URL=&quot;file:./dev.db&quot;</span> (файл рядом со схемой в{' '}
            <span className="text-notion-muted">server/prisma/sqlite/</span>). Для облака Timeweb — строка{' '}
            <span className="text-notion-muted">postgresql://…</span>, см. <span className="text-notion-muted">server/.env.example</span>.
          </p>
        )}
        <code className="text-xs text-left w-full bg-notion-surface border border-notion-border rounded-lg p-3 text-emerald-200/90 whitespace-pre-wrap">
          cd /path/to/Base56{'\n'}
          npm install && npm install --prefix server{'\n'}
          npm run dev
        </code>
        <p className="text-xs mt-4 text-notion-muted/80 text-left w-full">
          Альтернатива без миграций в начале: <span className="text-notion-muted">npm run dev:only</span> (если{' '}
          <span className="text-notion-muted">npm run dev</span> падает на Prisma).
        </p>
        <p className="text-xs mt-3 text-rose-300/90 break-words w-full text-left" role="status">
          {errText}
        </p>
      </div>
    );
  }

  const showMonthChrome = activeView !== 'settings' && activeView !== 'assistant';

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-notion-bg">
      <Sidebar
        activeView={activeView}
        onViewChange={setMainView}
        onOpenProfileSettings={openProfileSettings}
        open={desktopSidebarOpen}
        onCollapse={() => setDesktopSidebarOpen(false)}
        currentUser={currentUser}
      />
      <main className="flex-1 flex flex-col min-w-0 min-h-0 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="border-b border-notion-border px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 bg-notion-bg/95 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3">
          <div className="flex items-start sm:items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1">
            {!desktopSidebarOpen ? (
              <button
                type="button"
                onClick={() => setDesktopSidebarOpen(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white transition-colors shrink-0"
                title="Показать боковое меню"
                aria-label="Показать боковое меню"
              >
                <PanelLeft className="w-4 h-4 shrink-0 opacity-90" />
                <span className="text-xs font-medium leading-none">Меню</span>
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {activeView === 'settings' ? (
                <h1 className="text-lg font-semibold text-white">
                  {settingsTab === 'profile' ? 'Профиль' : 'Настройки'}
                </h1>
              ) : activeView === 'assistant' ? (
                <h1 className="text-lg font-semibold text-white">Ассистент</h1>
              ) : activeView === 'dashboard' ? (
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs text-notion-muted uppercase tracking-wide">Дашборд</span>
                  <p className="text-sm sm:text-base font-semibold text-white capitalize truncate leading-tight">
                    {dashboardSubtitle}
                  </p>
                </div>
              ) : activeView === 'gallery' && galleryPeriodMode === 'all' ? (
                <h1 className="text-lg font-semibold text-white">Плитки</h1>
              ) : activeView === 'gallery' && galleryPeriodMode === 'year' ? (
                <YearNav
                  monthCursor={monthCursor}
                  onPrev={() => setMonthCursor((c) => addYears(c, -1))}
                  onNext={() => setMonthCursor((c) => addYears(c, 1))}
                  onToday={() => setMonthCursor(startOfMonth(startOfYear(new Date())))}
                />
              ) : activeView === 'table' && tablePeriodMode === 'all' ? (
                <h1 className="text-lg font-semibold text-white">Таблица</h1>
              ) : activeView === 'table' && tablePeriodMode === 'year' ? (
                <YearNav
                  monthCursor={monthCursor}
                  onPrev={() => setMonthCursor((c) => addYears(c, -1))}
                  onNext={() => setMonthCursor((c) => addYears(c, 1))}
                  onToday={() => setMonthCursor(startOfMonth(startOfYear(new Date())))}
                />
              ) : (
                <MonthNav
                  monthCursor={monthCursor}
                  onPrev={() => setMonthCursor((c) => addMonths(c, -1))}
                  onNext={() => setMonthCursor((c) => addMonths(c, 1))}
                  onToday={() => setMonthCursor(startOfMonth(new Date()))}
                />
              )}
            </div>
          </div>
          {showMonthChrome ? (
            <>
              {activeView === 'calendar' ? (
                <div className="md:hidden flex flex-row items-center justify-end gap-2 w-full shrink-0">
                  <div className="relative shrink-0" ref={calendarMobileMenuRef}>
                    <button
                      type="button"
                      onClick={() => setCalendarMobileMenuOpen((o) => !o)}
                      aria-expanded={calendarMobileMenuOpen}
                      aria-haspopup="menu"
                      className="relative inline-flex items-center justify-center w-11 h-11 rounded-lg border border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white transition-colors touch-manipulation"
                      title="Ещё: фильтры, поля, итог"
                    >
                      <MoreVertical className="w-5 h-5" />
                      {calendarFiltersActiveHint && !calendarFiltersOpen ? (
                        <span
                          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-400 shadow-sm"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                    {calendarMobileMenuOpen ? (
                      <div
                        className="absolute left-0 top-full z-[140] mt-1.5 w-[min(18rem,calc(100vw-1.5rem))] max-w-[calc(100vw-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)-1.5rem)] origin-top-left rounded-xl border border-notion-border bg-notion-bg shadow-2xl py-1 text-sm"
                        role="menu"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className={`relative flex w-full items-center gap-2 px-3 py-2.5 text-left font-medium touch-manipulation ${
                            calendarFiltersOpen
                              ? 'bg-violet-500/15 text-violet-100'
                              : 'text-white hover:bg-notion-hover'
                          }`}
                          onClick={() => {
                            setCalendarMobileMenuOpen(false);
                            updateClientUi((prev) => {
                              const next = !prev.calendarFiltersPanelOpen;
                              return {
                                ...prev,
                                calendarFiltersPanelOpen: next,
                                calendarTileFieldsPanelOpen: next ? false : prev.calendarTileFieldsPanelOpen,
                              };
                            });
                          }}
                        >
                          <ListFilter className="w-4 h-4 shrink-0 opacity-90" />
                          Фильтры
                          {calendarFiltersActiveHint && !calendarFiltersOpen ? (
                            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-violet-400" aria-hidden />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left font-medium touch-manipulation ${
                            calendarTileFieldsOpen
                              ? 'bg-violet-500/15 text-violet-100'
                              : 'text-white hover:bg-notion-hover'
                          }`}
                          onClick={() => {
                            setCalendarMobileMenuOpen(false);
                            updateClientUi((prev) => {
                              const next = !prev.calendarTileFieldsPanelOpen;
                              return {
                                ...prev,
                                calendarTileFieldsPanelOpen: next,
                                calendarFiltersPanelOpen: next ? false : prev.calendarFiltersPanelOpen,
                              };
                            });
                          }}
                        >
                          <LayoutTemplate className="w-4 h-4 shrink-0 opacity-90" />
                          Поля карточки
                        </button>
                        <div
                          className="mx-2 my-1.5 rounded-lg border border-emerald-500/25 bg-emerald-950/35 px-2.5 py-2"
                          role="presentation"
                        >
                          <span className="text-[9px] font-medium uppercase tracking-wide text-emerald-200/65">
                            Итого за месяц
                          </span>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-base font-semibold text-emerald-100 tabular-nums">
                              {formatRub(monthTotalRub)}
                            </span>
                            <span className="text-[10px] text-emerald-200/40 tabular-nums">
                              {monthBookings.length} {pluralRecordsRu(monthBookings.length)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openNew()}
                    className="inline-flex flex-1 min-w-0 items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-notion-bg text-sm font-medium hover:bg-white/90 transition-colors shadow-sm touch-manipulation"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    Новая запись
                  </button>
                </div>
              ) : null}
              <div
                className={`${
                  activeView === 'calendar' ? 'hidden md:flex' : 'flex'
                } flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto sm:shrink-0 sm:justify-end`}
              >
              {activeView === 'gallery' || activeView === 'calendar' || activeView === 'table' ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      updateClientUi((prev) => {
                        if (activeView === 'gallery') {
                          const next = !prev.galleryFiltersPanelOpen;
                          return {
                            ...prev,
                            galleryFiltersPanelOpen: next,
                            galleryTileFieldsPanelOpen: next ? false : prev.galleryTileFieldsPanelOpen,
                          };
                        }
                        if (activeView === 'calendar') {
                          const next = !prev.calendarFiltersPanelOpen;
                          return {
                            ...prev,
                            calendarFiltersPanelOpen: next,
                            calendarTileFieldsPanelOpen: next ? false : prev.calendarTileFieldsPanelOpen,
                          };
                        }
                        const next = !prev.tableFiltersPanelOpen;
                        return {
                          ...prev,
                          tableFiltersPanelOpen: next,
                          tableTileFieldsPanelOpen: next ? false : prev.tableTileFieldsPanelOpen,
                        };
                      })
                    }
                    aria-pressed={
                      activeView === 'gallery'
                        ? galleryFiltersOpen
                        : activeView === 'calendar'
                          ? calendarFiltersOpen
                          : tableFiltersOpen
                    }
                    title={
                      (activeView === 'gallery' ? galleryFiltersOpen : activeView === 'calendar' ? calendarFiltersOpen : tableFiltersOpen)
                        ? 'Скрыть фильтры'
                        : 'Показать фильтры'
                    }
                    className={`relative inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors touch-manipulation shrink-0 ${
                      (activeView === 'gallery' ? galleryFiltersOpen : activeView === 'calendar' ? calendarFiltersOpen : tableFiltersOpen)
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                        : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white'
                    }`}
                  >
                    <ListFilter className="w-4 h-4 shrink-0" />
                    Фильтры
                    {(activeView === 'gallery'
                      ? galleryFiltersActiveHint && !galleryFiltersOpen
                      : activeView === 'calendar'
                        ? calendarFiltersActiveHint && !calendarFiltersOpen
                        : tableFiltersActiveHint && !tableFiltersOpen) ? (
                      <span
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-400 shadow-sm"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateClientUi((prev) => {
                        if (activeView === 'gallery') {
                          const next = !prev.galleryTileFieldsPanelOpen;
                          return {
                            ...prev,
                            galleryTileFieldsPanelOpen: next,
                            galleryFiltersPanelOpen: next ? false : prev.galleryFiltersPanelOpen,
                          };
                        }
                        if (activeView === 'calendar') {
                          const next = !prev.calendarTileFieldsPanelOpen;
                          return {
                            ...prev,
                            calendarTileFieldsPanelOpen: next,
                            calendarFiltersPanelOpen: next ? false : prev.calendarFiltersPanelOpen,
                          };
                        }
                        const next = !prev.tableTileFieldsPanelOpen;
                        return {
                          ...prev,
                          tableTileFieldsPanelOpen: next,
                          tableFiltersPanelOpen: next ? false : prev.tableFiltersPanelOpen,
                        };
                      })
                    }
                    aria-pressed={
                      activeView === 'gallery'
                        ? galleryTileFieldsOpen
                        : activeView === 'calendar'
                          ? calendarTileFieldsOpen
                          : tableTileFieldsOpen
                    }
                    title={
                      activeView === 'table'
                        ? tableTileFieldsOpen
                          ? 'Скрыть настройку столбцов'
                          : 'Поля таблицы'
                        : (activeView === 'gallery' ? galleryTileFieldsOpen : calendarTileFieldsOpen)
                          ? 'Скрыть настройку полей'
                          : 'Поля карточки'
                    }
                    className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors touch-manipulation shrink-0 ${
                      (activeView === 'gallery'
                        ? galleryTileFieldsOpen
                        : activeView === 'calendar'
                          ? calendarTileFieldsOpen
                          : tableTileFieldsOpen)
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                        : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white'
                    }`}
                  >
                    <LayoutTemplate className="w-4 h-4 shrink-0" />
                    {activeView === 'table' ? 'Поля таблицы' : 'Поля карточки'}
                  </button>
                </>
              ) : null}
              {activeView === 'dashboard' ? (
                <button
                  type="button"
                  onClick={() =>
                    updateClientUi((prev) => ({
                      ...prev,
                      dashboardPeriodPanelOpen: !prev.dashboardPeriodPanelOpen,
                    }))
                  }
                  aria-pressed={dashboardPeriodPanelOpen}
                  title={dashboardPeriodPanelOpen ? 'Закрыть панель периода' : 'Период отчёта'}
                  className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors touch-manipulation shrink-0 ${
                    dashboardPeriodPanelOpen
                      ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                      : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white'
                  }`}
                >
                  <CalendarRange className="w-4 h-4 shrink-0" />
                  Период
                </button>
              ) : null}
              {activeView !== 'dashboard' ? (
                <div
                  className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-emerald-500/25 bg-emerald-950/35 px-2 py-1 sm:py-0.5 sm:px-2.5"
                  title="Сумма полей «Сумма» по всем записям выбранного месяца"
                >
                  <span className="text-[9px] font-medium uppercase tracking-wide text-emerald-200/65 leading-tight">
                    Итого за месяц
                  </span>
                  <span className="text-base font-semibold text-emerald-100 tabular-nums leading-none tracking-tight">
                    {formatRub(monthTotalRub)}
                  </span>
                  <span className="text-[10px] text-emerald-200/40 tabular-nums leading-none">
                    {monthBookings.length} {pluralRecordsRu(monthBookings.length)}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => openNew()}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg bg-white text-notion-bg text-sm font-medium hover:bg-white/90 transition-colors shadow-sm touch-manipulation shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Новая запись
              </button>
            </div>
            </>
          ) : null}
        </header>
        {toast ? (
          <div className="px-3 sm:px-6 py-2 text-sm text-rose-300 bg-rose-950/25 border-b border-rose-500/20">
            {toast}
          </div>
        ) : null}
        <div className="flex-1 p-3 sm:p-6 overflow-auto min-h-0">
          {activeView === 'dashboard' ? (
            <DashboardView
              bookings={bookings}
              monthCursor={monthCursor}
              fields={fields}
              onOpenBooking={openEdit}
              dashboardPeriod={dashboardPeriod}
            />
          ) : null}
          {activeView === 'calendar' ? (
            <CalendarView
              monthCursor={monthCursor}
              bookings={bookings}
              fields={fields}
              onOpenBooking={openEdit}
              onCreateOnDate={openNew}
              onMonthForDayChange={(d) => setMonthCursor(startOfMonth(d))}
              onMoveBooking={(id, nextDate) => {
                const b = bookings.find((x) => x.id === id);
                if (!b) return;
                if (b.date === nextDate) return;
                void handleSave({ ...b, date: nextDate });
              }}
              clientUi={clientUi}
              updateClientUi={updateClientUi}
            />
          ) : null}
          {activeView === 'gallery' ? (
            <GalleryView
              bookings={bookings}
              monthCursor={monthCursor}
              fields={fields}
              onOpenBooking={openEdit}
              clientUi={clientUi}
              updateClientUi={updateClientUi}
            />
          ) : null}
          {activeView === 'table' ? (
            <TableView
              bookings={bookings}
              monthCursor={monthCursor}
              fields={fields}
              onOpenBooking={openEdit}
              clientUi={clientUi}
              updateClientUi={updateClientUi}
            />
          ) : null}
          {activeView === 'assistant' ? <AssistantView /> : null}
          {activeView === 'settings' ? (
            <SettingsView
              fields={fields}
              onFieldsChange={refreshFields}
              refreshBookings={refreshBookings}
              refreshClientUi={refreshClientUi}
              bookingCount={bookings.length}
              patchFieldLocal={patchFieldLocal}
              createFieldLocal={createFieldLocal}
              deleteFieldLocal={deleteFieldLocal}
              reorderFieldsLocal={reorderFieldsLocal}
              flushNow={flushNow}
              currentUser={currentUser}
              settingsTab={settingsTab}
              onSettingsTabChange={setSettingsTab}
            />
          ) : null}
        </div>

        <FloatingSidePanel
          open={dashboardPeriodPanelOpen}
          onClose={() => updateClientUi((prev) => ({ ...prev, dashboardPeriodPanelOpen: false }))}
          title="Период отчёта"
        >
          <DashboardPeriodPanelContent
            dashboardPeriod={dashboardPeriod}
            monthCursor={monthCursor}
            setMonthCursor={setMonthCursor}
            onChangePeriod={(next) => updateClientUi((prev) => ({ ...prev, dashboardPeriod: next }))}
          />
        </FloatingSidePanel>
      </main>

      <BookingModal
        open={modalOpen}
        booking={modalBooking}
        fields={fields}
        canDelete={Boolean(modalBooking && bookings.some((b) => b.id === modalBooking.id))}
        onSave={handleSave}
        onFlushSync={handleFlushSync}
        onClose={() => {
          setModalOpen(false);
          setModalBooking(null);
        }}
        onDelete={handleDelete}
      />
      <MobileNav activeView={activeView} onViewChange={setMainView} />

      {syncError ? (
        <div
          className="fixed z-[60] pointer-events-none left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-6 md:bottom-6"
          aria-live="assertive"
        >
          <div className="pointer-events-auto rounded-xl border border-notion-border/90 bg-[#252525]/95 backdrop-blur-md shadow-2xl px-3.5 py-3 text-sm text-white/95">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-400/90 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-amber-100/95">Не удалось сохранить</p>
                  <p className="text-xs text-notion-muted mt-1 break-words">{syncError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearSyncError();
                  void flushNow();
                }}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-2 rounded-lg border border-amber-500/35 bg-amber-950/40 text-amber-100 text-xs font-medium hover:bg-amber-900/50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                Повторить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

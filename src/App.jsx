import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, addYears, startOfMonth, startOfYear } from 'date-fns';
import {
  AlertCircle,
  LayoutTemplate,
  ListFilter,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { AssistantView } from '@/components/AssistantView';
import { BookingModal } from '@/components/BookingModal';
import { CalendarView } from '@/components/CalendarView';
import { DashboardPeriodTopRow } from '@/components/DashboardPeriodPanel';
import { DashboardView } from '@/components/DashboardView';
import { GalleryView } from '@/components/GalleryView';
import { MobileNav } from '@/components/MobileNav';
import { MonthNav } from '@/components/MonthNav';
import { YearNav } from '@/components/YearNav';
import { SettingsView } from '@/components/SettingsView';
import { Sidebar } from '@/components/Sidebar';
import { TableView } from '@/components/TableView';
import { SettingsThemeToggle } from '@/components/ThemeToggle.jsx';
import { useBookingsAndFields } from '@/hooks/useBookingsAndFields';
import { filterByMonth } from '@/lib/bookingUtils';
import { createEmptyBooking } from '@/lib/emptyBooking';
import { formatRub } from '@/lib/format';
import {
  isGalleryPrefsActive,
  isGalleryTileFieldPrefsActive,
  isViewFiltersActive,
} from '@/lib/galleryFilterPrefs';
import { useTheme } from '@/theme/ThemeProvider.jsx';
import { runViewTransition } from '@/viewTransition.js';

const SIDEBAR_KEY = 'base56-sidebar-open';
const LEGACY_SIDEBAR_KEY = 'photocrm-sidebar-open';

function readSidebarCollapsed() {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    if (v === '0') return true;
    if (v === '1') return false;
    const legacy = localStorage.getItem(LEGACY_SIDEBAR_KEY);
    if (legacy === '0') return true;
    return false;
  } catch {
    return false;
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
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!ready) return;
    setTheme(clientUi.theme);
  }, [ready, clientUi.theme, setTheme]);

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [activeView, setActiveView] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBooking, setModalBooking] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed());
  const [settingsTab, setSettingsTab] = useState(/** @type {'profile' | 'fields'} */ ('fields'));
  const [toast, setToast] = useState('');
  function setMainView(/** @type {string} */ view) {
    runViewTransition(() => {
      setActiveView(view);
      if (view === 'settings') setSettingsTab('fields');
    });
  }

  function openProfileSettings() {
    runViewTransition(() => {
      setActiveView('settings');
      setSettingsTab('profile');
    });
  }

  function setSettingsTabWithTransition(/** @type {'profile' | 'fields'} */ tab) {
    runViewTransition(() => {
      setSettingsTab(tab);
    });
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

  const galleryTileFieldsActiveHint = isGalleryTileFieldPrefsActive(clientUi.galleryTileFieldVisible);
  const calendarTileFieldsActiveHint = isGalleryTileFieldPrefsActive(clientUi.calendarTileFieldVisible);
  const tableTileFieldsActiveHint = isGalleryTileFieldPrefsActive(clientUi.tableTileFieldVisible);

  const dashboardPeriod = clientUi.dashboardPeriod;

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '0' : '1');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
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
        <p className="text-notion-fg font-medium mb-2">Не удалось связаться с API</p>
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
        <code className="text-xs text-left w-full bg-notion-surface border border-notion-border rounded-lg p-3 text-brand/85 whitespace-pre-wrap">
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
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activeView={activeView}
        onViewChange={setMainView}
        onOpenProfileSettings={openProfileSettings}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        currentUser={currentUser}
        clientUi={clientUi}
        updateClientUi={updateClientUi}
      />
      <main className="main pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0 pt-[max(0px,env(safe-area-inset-top))]">
        <header
          className={`topbar flex-wrap gap-y-2 md:flex-nowrap md:items-center md:gap-y-0 ${
            showMonthChrome
              ? 'md:box-border md:h-[4.25rem] md:min-h-[4.25rem] md:max-h-[4.25rem] md:overflow-hidden md:py-2.5 md:leading-none'
              : ''
          }`}
        >
          <div className="flex w-full min-w-0 items-center justify-between gap-3 md:contents">
            <div className="topbar-left min-w-0 flex-1">
              <div className="min-w-0 flex-1">
              {activeView === 'settings' ? (
                <>
                  <span className="crumb-label">Настройки</span>
                  <h1 className="page-title">
                    {settingsTab === 'profile' ? 'Профиль' : 'Поля и карточка'}
                  </h1>
                </>
              ) : activeView === 'assistant' ? (
                <>
                  <span className="crumb-label">Чат</span>
                  <h1 className="page-title">Ассистент</h1>
                </>
              ) : activeView === 'dashboard' ? (
                <DashboardPeriodTopRow
                  dashboardPeriod={dashboardPeriod}
                  monthCursor={monthCursor}
                  setMonthCursor={setMonthCursor}
                  onChangePeriod={(next) =>
                    updateClientUi((prev) => ({ ...prev, dashboardPeriod: next }))
                  }
                />
              ) : activeView === 'gallery' && galleryPeriodMode === 'all' ? (
                <>
                  <span className="crumb-label">Записи</span>
                  <h1 className="page-title">Плитки</h1>
                </>
              ) : activeView === 'gallery' && galleryPeriodMode === 'year' ? (
                <YearNav
                  monthCursor={monthCursor}
                  onPrev={() => setMonthCursor((c) => addYears(c, -1))}
                  onNext={() => setMonthCursor((c) => addYears(c, 1))}
                  onToday={() => setMonthCursor(startOfMonth(startOfYear(new Date())))}
                />
              ) : activeView === 'table' && tablePeriodMode === 'all' ? (
                <>
                  <span className="crumb-label">Записи</span>
                  <h1 className="page-title">Таблица</h1>
                </>
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
            <div className="flex shrink-0 items-center md:hidden min-w-[5.5rem]">
              <SettingsThemeToggle
                clientUi={clientUi}
                updateClientUi={updateClientUi}
                className="w-full min-w-[5.5rem]"
              />
            </div>
          </div>
          {showMonthChrome ? (
            <div className="topbar-right flex-wrap justify-end md:flex-nowrap md:overflow-x-auto md:overflow-y-visible overscroll-x-contain [scrollbar-width:thin]">
              <div
                className={
                  activeView === 'calendar' || activeView === 'gallery' || activeView === 'table'
                    ? 'grid w-full min-w-0 grid-cols-2 items-stretch gap-2 sm:flex sm:flex-row sm:flex-nowrap sm:items-center sm:gap-3 sm:justify-end sm:w-auto sm:shrink-0'
                    : 'flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-3 sm:justify-end sm:w-auto sm:shrink-0'
                }
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
                    className={`inline-flex h-10 min-h-10 max-h-10 min-w-0 items-center justify-center gap-1.5 px-2.5 w-full sm:w-auto sm:gap-2 sm:px-3 rounded-full border text-sm font-medium leading-none transition-colors touch-manipulation shrink-0 ${
                      (activeView === 'gallery' ? galleryFiltersOpen : activeView === 'calendar' ? calendarFiltersOpen : tableFiltersOpen)
                        ? 'border-brand/45 bg-brand/15 text-brand'
                        : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-notion-fg'
                    }`}
                  >
                    <ListFilter className="w-4 h-4 shrink-0" />
                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                      Фильтры
                      {(activeView === 'gallery'
                        ? galleryFiltersActiveHint && !galleryFiltersOpen
                        : activeView === 'calendar'
                          ? calendarFiltersActiveHint && !calendarFiltersOpen
                          : tableFiltersActiveHint && !tableFiltersOpen) ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]"
                          aria-hidden
                        />
                      ) : null}
                    </span>
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
                    className={`inline-flex h-10 min-h-10 max-h-10 min-w-0 items-center justify-center gap-1.5 px-2.5 w-full sm:w-auto sm:gap-2 sm:px-3 rounded-full border text-sm font-medium leading-none transition-colors touch-manipulation shrink-0 ${
                      (activeView === 'gallery'
                        ? galleryTileFieldsOpen
                        : activeView === 'calendar'
                          ? calendarTileFieldsOpen
                          : tableTileFieldsOpen)
                        ? 'border-brand/45 bg-brand/15 text-brand'
                        : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-notion-fg'
                    }`}
                  >
                    <LayoutTemplate className="w-4 h-4 shrink-0" />
                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                      {activeView === 'table' ? 'Поля таблицы' : 'Поля карточки'}
                      {(activeView === 'gallery'
                        ? galleryTileFieldsActiveHint && !galleryTileFieldsOpen
                        : activeView === 'calendar'
                          ? calendarTileFieldsActiveHint && !calendarTileFieldsOpen
                          : tableTileFieldsActiveHint && !tableTileFieldsOpen) ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  </button>
                </>
              ) : null}
              {activeView !== 'dashboard' ? (
                <div
                  className="flex h-10 min-h-10 max-h-10 w-full min-w-0 flex-nowrap items-center justify-center gap-x-1.5 whitespace-nowrap rounded-full border border-[color:var(--accent-soft-strong)] bg-[var(--accent-soft)] px-2 sm:inline-flex sm:w-auto sm:shrink-0 sm:justify-start sm:gap-x-2 sm:px-3"
                  title="Сумма полей «Сумма» по всем записям выбранного месяца"
                >
                  <span className="text-[9px] font-medium uppercase tracking-wide leading-none text-[color:var(--accent)]">
                    Итого за месяц
                  </span>
                  <span className="text-base font-semibold tabular-nums leading-none tracking-tight text-[color:var(--accent)]">
                    {formatRub(monthTotalRub)}
                  </span>
                  <span className="text-[10px] tabular-nums leading-none text-[color:var(--accent)]/75">
                    {monthBookings.length} {pluralRecordsRu(monthBookings.length)}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => openNew()}
                className="btn btn-primary h-10 min-h-10 max-h-10 w-full touch-manipulation sm:w-auto shrink-0 leading-none"
              >
                <Plus className="shrink-0" aria-hidden />
                Новая запись
              </button>
            </div>
          </div>
          ) : null}
        </header>
        {toast ? (
          <div className="px-3 sm:px-6 py-2 text-sm text-rose-300 bg-rose-950/25 border-b border-rose-500/20">
            {toast}
          </div>
        ) : null}
        <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
          <div className="view-transition-main min-h-full">
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
              onSettingsTabChange={setSettingsTabWithTransition}
            />
          ) : null}
          </div>
        </div>
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
          <div className="pointer-events-auto rounded-xl border border-notion-border/90 bg-notion-surface/95 backdrop-blur-md shadow-2xl px-3.5 py-3 text-sm text-notion-fg/95">
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
                className="shrink-0 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-2 rounded-full border border-amber-500/35 bg-amber-950/40 text-amber-100 text-xs font-medium hover:bg-amber-900/50 transition-colors"
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

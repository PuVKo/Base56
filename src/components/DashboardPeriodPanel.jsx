import { addMonths, addYears, format, startOfMonth, startOfYear } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MonthNav } from '@/components/MonthNav';
import { YearNav } from '@/components/YearNav';

const PERIOD_OPTIONS = [
  ['month', 'Месяц'],
  ['year', 'Год'],
  ['all', 'Всё время'],
];

/**
 * @param {object} p
 * @param {'month' | 'year' | 'all'} p.dashboardPeriod
 * @param {(next: 'month' | 'year' | 'all') => void} p.onChangePeriod
 * @param {(fn: (c: Date) => Date) => void} p.setMonthCursor
 * @param {boolean} [p.compact]
 * @param {string} [p.className]
 */
export function DashboardPeriodModeButtons({
  dashboardPeriod,
  onChangePeriod,
  setMonthCursor,
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`flex flex-wrap items-center ${compact ? 'gap-1.5' : 'gap-2'} ${className}`.trim()}
      role="group"
      aria-label="Период отчёта"
    >
      {PERIOD_OPTIONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            const pid = /** @type {'month' | 'year' | 'all'} */ (id);
            onChangePeriod(pid);
            if (pid === 'year') setMonthCursor((c) => startOfMonth(startOfYear(c)));
            if (pid === 'month' && dashboardPeriod !== 'month') {
              setMonthCursor(startOfMonth(new Date()));
            }
          }}
          className={`rounded-lg border transition-colors touch-manipulation ${
            compact ? 'px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm' : 'px-3 py-2 text-sm'
          } ${
            dashboardPeriod === id
              ? 'bg-brand/18 border-brand/45 text-brand font-medium'
              : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-notion-fg'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Шапка дашборда: сначала навигация (месяц / год / заголовок «Всё время»), затем «Месяц | Год | Всё время».
 */
export function DashboardPeriodTopRow({
  dashboardPeriod,
  onChangePeriod,
  setMonthCursor,
  monthCursor,
}) {
  return (
    <div className="flex flex-nowrap items-center gap-2 min-w-0 w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
      {dashboardPeriod === 'month' ? (
        <MonthNav
          variant="inline"
          monthCursor={monthCursor}
          onPrev={() => setMonthCursor((c) => addMonths(c, -1))}
          onNext={() => setMonthCursor((c) => addMonths(c, 1))}
          onToday={() => setMonthCursor(startOfMonth(new Date()))}
        />
      ) : null}
      {dashboardPeriod === 'year' ? (
        <YearNav
          variant="inline"
          monthCursor={monthCursor}
          onPrev={() => setMonthCursor((c) => addYears(c, -1))}
          onNext={() => setMonthCursor((c) => addYears(c, 1))}
          onToday={() => setMonthCursor(startOfMonth(startOfYear(new Date())))}
        />
      ) : null}
      {dashboardPeriod === 'all' ? (
        <h1 className="month-title mb-0 min-w-0 truncate capitalize shrink-0">Всё время</h1>
      ) : null}
      <DashboardPeriodModeButtons
        compact
        className="shrink-0"
        dashboardPeriod={dashboardPeriod}
        onChangePeriod={onChangePeriod}
        setMonthCursor={setMonthCursor}
      />
    </div>
  );
}

/**
 * Месяц / год / подсказка «всё время» под переключателем режима.
 * @param {object} p
 * @param {'month' | 'year' | 'all'} p.dashboardPeriod
 * @param {Date} p.monthCursor
 * @param {(fn: (c: Date) => Date) => void} p.setMonthCursor
 * @param {boolean} [p.compact]
 */
export function DashboardPeriodDetailSection({ dashboardPeriod, monthCursor, setMonthCursor, compact = false }) {
  const labelClass = compact ? 'text-[11px] text-notion-muted mb-1.5' : 'text-xs text-notion-muted mb-2';

  return (
    <>
      {dashboardPeriod === 'month' ? (
        <div className="w-full min-w-0">
          <p className={labelClass}>Месяц</p>
          <MonthNav
            monthCursor={monthCursor}
            onPrev={() => setMonthCursor((c) => addMonths(c, -1))}
            onNext={() => setMonthCursor((c) => addMonths(c, 1))}
            onToday={() => setMonthCursor(startOfMonth(new Date()))}
          />
        </div>
      ) : null}

      {dashboardPeriod === 'year' ? (
        <div className="w-full min-w-0">
          <p className={labelClass}>Календарный год</p>
          <YearNav
            monthCursor={monthCursor}
            onPrev={() => setMonthCursor((c) => addYears(c, -1))}
            onNext={() => setMonthCursor((c) => addYears(c, 1))}
            onToday={() => setMonthCursor(startOfMonth(startOfYear(new Date())))}
          />
          <p className={`text-notion-muted ${compact ? 'text-xs mt-2' : 'text-xs mt-3'}`}>
            Сводка за {format(monthCursor, 'yyyy', { locale: ru })} год (январь — декабрь).
          </p>
        </div>
      ) : null}

      {dashboardPeriod === 'all' ? (
        <p className="text-sm text-notion-muted leading-relaxed">
          Учитываются все записи с датой съёмки. График «Динамика» внизу строится по текущему календарному году.
        </p>
      ) : null}
    </>
  );
}

/**
 * Содержимое панели выбора периода дашборда (блоком: заголовок + кнопки + детали).
 * @param {object} p
 * @param {'month' | 'year' | 'all'} p.dashboardPeriod
 * @param {(next: 'month' | 'year' | 'all') => void} p.onChangePeriod
 * @param {Date} p.monthCursor
 * @param {(fn: (c: Date) => Date) => void} p.setMonthCursor
 */
export function DashboardPeriodPanelContent({ dashboardPeriod, onChangePeriod, monthCursor, setMonthCursor }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] text-notion-muted uppercase tracking-wide mb-2">Период отчёта</p>
        <DashboardPeriodModeButtons
          dashboardPeriod={dashboardPeriod}
          onChangePeriod={onChangePeriod}
          setMonthCursor={setMonthCursor}
        />
      </div>
      <DashboardPeriodDetailSection
        dashboardPeriod={dashboardPeriod}
        monthCursor={monthCursor}
        setMonthCursor={setMonthCursor}
      />
    </div>
  );
}

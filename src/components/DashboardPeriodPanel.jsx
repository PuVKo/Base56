import { addMonths, addYears, format, startOfMonth, startOfYear } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MonthNav } from '@/components/MonthNav';
import { YearNav } from '@/components/YearNav';

/**
 * Содержимое панели выбора периода дашборда (без оболочки — её даёт FloatingSidePanel).
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
        <div className="flex flex-wrap gap-2">
          {[
            ['month', 'Месяц'],
            ['year', 'Год'],
            ['all', 'Всё время'],
          ].map(([id, label]) => (
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
              className={`px-3 py-2 rounded-lg text-sm border transition-colors touch-manipulation ${
                dashboardPeriod === id
                  ? 'bg-violet-600/25 border-violet-500/50 text-white'
                  : 'border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {dashboardPeriod === 'month' ? (
        <div>
          <p className="text-xs text-notion-muted mb-2">Месяц</p>
          <MonthNav
            monthCursor={monthCursor}
            onPrev={() => setMonthCursor((c) => addMonths(c, -1))}
            onNext={() => setMonthCursor((c) => addMonths(c, 1))}
            onToday={() => setMonthCursor(startOfMonth(new Date()))}
          />
        </div>
      ) : null}

      {dashboardPeriod === 'year' ? (
        <div>
          <p className="text-xs text-notion-muted mb-2">Календарный год</p>
          <YearNav
            monthCursor={monthCursor}
            onPrev={() => setMonthCursor((c) => addYears(c, -1))}
            onNext={() => setMonthCursor((c) => addYears(c, 1))}
            onToday={() => setMonthCursor(startOfMonth(startOfYear(new Date())))}
          />
          <p className="text-xs text-notion-muted mt-3">
            Сводка за {format(monthCursor, 'yyyy', { locale: ru })} год (январь — декабрь).
          </p>
        </div>
      ) : null}

      {dashboardPeriod === 'all' ? (
        <p className="text-sm text-notion-muted leading-relaxed">
          Учитываются все записи с датой съёмки. График «Динамика» внизу строится по текущему календарному году.
        </p>
      ) : null}
    </div>
  );
}

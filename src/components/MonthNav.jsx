import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * @param {object} props
 * @param {'default' | 'inline'} [props.variant] inline — одна горизонтальная линия (шапка дашборда и т.п.)
 */
export function MonthNav({ monthCursor, onPrev, onNext, onToday, variant = 'default' }) {
  const labelFull = format(monthCursor, 'LLLL yyyy', { locale: ru });
  const labelShort = format(monthCursor, 'LLL yyyy', { locale: ru });
  const inline = variant === 'inline';
  return (
    <div
      className={
        inline
          ? 'flex flex-row flex-nowrap items-center gap-2 min-w-0 shrink-0 sm:gap-3'
          : 'flex flex-row flex-nowrap items-center gap-2 w-full min-w-0 sm:gap-3'
      }
    >
      <div className="month-nav">
        <button type="button" onClick={onPrev} className="icon-btn" aria-label="Предыдущий месяц">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={onNext} className="icon-btn" aria-label="Следующий месяц">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h1 className="month-title capitalize min-w-0 flex-1 sm:flex-none truncate">
          <span className="sm:hidden">{labelShort}</span>
          <span className="hidden sm:inline">{labelFull}</span>
        </h1>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="inline-flex h-8 max-h-8 min-h-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent px-3 text-sm font-medium leading-none tracking-normal text-notion-muted transition-colors hover:bg-notion-hover hover:text-notion-fg touch-manipulation"
      >
        Сегодня
      </button>
    </div>
  );
}

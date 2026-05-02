import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * @param {object} props
 * @param {Date} props.monthCursor
 * @param {() => void} props.onPrev
 * @param {() => void} props.onNext
 * @param {() => void} props.onToday
 * @param {'default' | 'inline'} [props.variant] inline — одна горизонтальная линия
 */
export function YearNav({ monthCursor, onPrev, onNext, onToday, variant = 'default' }) {
  const label = format(monthCursor, 'yyyy', { locale: ru });
  const inline = variant === 'inline';
  return (
    <div
      className={
        inline
          ? 'flex flex-row flex-nowrap items-center gap-2 min-w-0 shrink-0 sm:gap-3'
          : 'flex flex-col gap-2 w-full min-w-0 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-3 sm:w-auto'
      }
    >
      <div className="month-nav">
        <button type="button" onClick={onPrev} className="icon-btn" aria-label="Предыдущий год">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={onNext} className="icon-btn" aria-label="Следующий год">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h1 className="month-title tabular-nums min-w-0 flex-1 sm:flex-none sm:min-w-[6rem] truncate">{label}</h1>
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

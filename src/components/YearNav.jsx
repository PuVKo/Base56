import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Навигация по календарному году (тот же каркас, что у {@link MonthNav}).
 * @param {{ monthCursor: Date, onPrev: () => void, onNext: () => void, onToday: () => void }} props
 */
export function YearNav({ monthCursor, onPrev, onNext, onToday }) {
  const label = format(monthCursor, 'yyyy', { locale: ru });
  return (
    <div className="flex flex-col gap-2 w-full min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:w-auto">
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center rounded-lg border border-notion-border overflow-hidden">
          <button
            type="button"
            onClick={onPrev}
            className="p-2 sm:p-2 hover:bg-notion-hover text-notion-muted hover:text-white transition-colors touch-manipulation"
            aria-label="Предыдущий год"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="p-2 sm:p-2 hover:bg-notion-hover text-notion-muted hover:text-white border-l border-notion-border transition-colors touch-manipulation"
            aria-label="Следующий год"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h1 className="text-base sm:text-lg font-semibold text-white tabular-nums min-w-0 flex-1 sm:flex-none sm:min-w-[6rem] truncate">
          {label}
        </h1>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="text-xs px-2.5 py-1.5 rounded-md border border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white transition-colors touch-manipulation self-start sm:self-auto shrink-0"
      >
        Сегодня
      </button>
    </div>
  );
}

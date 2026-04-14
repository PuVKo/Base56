import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DISPLAY = 'dd.MM.yyyy';
const STORAGE = 'yyyy-MM-dd';

/**
 * @param {string} ymd yyyy-MM-dd
 * @returns {Date | null}
 */
function ymdToLocalDate(ymd) {
  const s = String(ymd ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (!isValid(dt) || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Разбор дд.мм.гггг (допускаются однозначные день/месяц)
 * @param {string} raw
 * @returns {string} yyyy-MM-dd | '' | '__invalid__'
 */
function parseDisplayToStorage(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return '__invalid__';
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) return '__invalid__';
  const dt = new Date(y, mo - 1, d);
  if (
    !isValid(dt) ||
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return '__invalid__';
  }
  return format(dt, STORAGE);
}

/**
 * Поле даты: ввод дд.мм.гггг + мини-календарь. В родителя уходит yyyy-MM-dd или ''.
 * @param {object} p
 * @param {string} p.value
 * @param {(ymd: string) => void} p.onChange
 * @param {string} [p.className]
 */
export function BookingDateInput({ value, onChange, className }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const syncTextFromValue = useCallback(() => {
    const d = ymdToLocalDate(value);
    if (!d) {
      setText('');
      return;
    }
    setText(format(d, DISPLAY));
    setMonth(startOfMonth(d));
  }, [value]);

  useEffect(() => {
    syncTextFromValue();
  }, [syncTextFromValue]);

  const commitText = useCallback(() => {
    const out = parseDisplayToStorage(text);
    if (out === '__invalid__') {
      syncTextFromValue();
      return;
    }
    onChange(out);
    if (out) {
      const d = ymdToLocalDate(out);
      if (d) {
        setText(format(d, DISPLAY));
        setMonth(startOfMonth(d));
      }
    } else {
      setText('');
    }
  }, [text, onChange, syncTextFromValue]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (!rootRef.current?.contains(/** @type {Node} */ (e.target))) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = ymdToLocalDate(value);
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function pickDay(day) {
    onChange(format(day, STORAGE));
    setText(format(day, DISPLAY));
    setOpen(false);
  }

  function clearDate() {
    onChange('');
    setText('');
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-stretch gap-2 min-w-0">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="дд.мм.гггг"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commitText()}
        className={`min-w-0 flex-1 ${className ?? ''}`}
      />
      <button
        type="button"
        aria-label="Открыть календарь"
        title="Календарь"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 inline-flex items-center justify-center w-10 rounded-lg border border-notion-border bg-notion-bg text-notion-muted hover:bg-notion-hover hover:text-white transition-colors"
      >
        <Calendar className="w-4 h-4" strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-[60] mt-1 w-[min(100%,17.5rem)] rounded-xl border border-notion-border bg-[#2a2a2a] shadow-2xl p-2.5"
          role="dialog"
          aria-label="Выбор даты"
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="p-1.5 rounded-md text-notion-muted hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-white capitalize truncate px-1">
              {format(month, 'LLLL yyyy', { locale: ru })}
            </span>
            <button
              type="button"
              aria-label="Следующий месяц"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-md text-notion-muted hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-[10px] font-medium text-notion-muted/80 py-0.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = isSameMonth(day, month);
              const isSel = selected && isSameDay(day, selected);
              const today = isToday(day);
              return (
                <button
                  key={format(day, STORAGE)}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickDay(day)}
                  className={[
                    'aspect-square max-h-8 text-xs rounded-md transition-colors tabular-nums',
                    inMonth ? 'text-white' : 'text-notion-muted/45',
                    isSel
                      ? 'bg-violet-600 text-white font-semibold'
                      : 'hover:bg-white/10',
                    today && !isSel ? 'ring-1 ring-inset ring-violet-500/50' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearDate}
            className="mt-2 w-full text-center text-xs text-notion-muted hover:text-white py-1.5 rounded-md hover:bg-white/5"
          >
            Без даты
          </button>
        </div>
      ) : null}
    </div>
  );
}

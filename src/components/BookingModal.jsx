import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { BookingDateInput } from '@/components/BookingDateInput';
import { ClientFieldInputs } from '@/components/ClientFieldInputs';
import { normalizeClientFieldValue } from '@/lib/clientField';
import { newId } from '@/lib/id';
import { getFieldOptionItems } from '@/lib/fieldOptions';
import { getFieldTypeMeta } from '@/lib/fieldTypeMeta';
import { notionPillClasses } from '@/lib/notionColors';
import { iconComponentByKey } from '@/lib/fieldIcons';

function clone(b) {
  return JSON.parse(JSON.stringify(b));
}

const inputCls =
  'w-full rounded-md border-0 border-b border-transparent bg-transparent px-0 py-1 text-sm text-white placeholder:text-notion-muted/50 focus:outline-none focus:border-violet-500/50 focus:ring-0';

const inputBordered =
  'w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white placeholder:text-notion-muted focus:outline-none focus:ring-2 focus:ring-violet-500/40';

const moneyInputShell =
  'w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm flex items-center gap-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-violet-500/40';

const moneyInputInner =
  'flex-1 min-w-0 min-h-[1.25rem] bg-transparent border-0 p-0 text-white tabular-nums placeholder:text-notion-muted focus:outline-none focus:ring-0';

/** @param {string} s */
function parseMoneyDigits(s) {
  const d = s.replace(/\D/g, '');
  if (!d) return 0;
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? Math.min(Math.max(0, n), Number.MAX_SAFE_INTEGER) : 0;
}

/** @param {number} n */
function formatThousandsInt(n) {
  if (!Number.isFinite(n) || n < 0) return '';
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * @param {object} p
 * @param {number} p.value
 * @param {(n: number) => void} p.onChange
 */
function MoneyIntInput({ value, onChange }) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? Math.min(Math.max(0, Math.floor(num)), Number.MAX_SAFE_INTEGER) : 0;
  const focusedRef = useRef(false);
  const [str, setStr] = useState(() => formatThousandsInt(safe));

  useEffect(() => {
    if (focusedRef.current) return;
    setStr(formatThousandsInt(safe));
  }, [safe]);

  return (
    <div className={moneyInputShell}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={moneyInputInner}
        placeholder="0"
        value={str}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          const p = parseMoneyDigits(str);
          onChange(p);
          setStr(formatThousandsInt(p));
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const p = parseMoneyDigits(raw);
          if (raw.replace(/\D/g, '') === '') {
            setStr('');
            onChange(0);
            return;
          }
          setStr(formatThousandsInt(p));
          onChange(p);
        }}
      />
      <span className="text-notion-muted shrink-0 select-none tabular-nums" aria-hidden>
        ₽
      </span>
    </div>
  );
}

/**
 * @param {object} p
 * @param {import('lucide-react').LucideIcon} p.Icon
 * @param {string} p.label
 * @param {import('react').ReactNode} p.children
 */
function PropertyRow({ Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 py-2 px-1 -mx-1 rounded-md hover:bg-white/[0.04] transition-colors">
      <Icon className="w-4 h-4 shrink-0 mt-1 text-notion-muted/75" strokeWidth={1.75} aria-hidden />
      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 flex-1 min-w-0">
        <span className="text-sm text-notion-muted shrink-0 sm:w-36 sm:pt-1">{label}</span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {Record<string, unknown> | null} props.booking
 * @param {(b: object, opts?: { silent?: boolean }) => void | Promise<void>} props.onSave
 * @param {() => Promise<void>} [props.onFlushSync]
 * @param {() => void} props.onClose
 * @param {(id: string) => void} props.onDelete
 * @param {boolean} props.canDelete
 * @param {any[]} props.fields
 */
export function BookingModal({ open, booking, onSave, onFlushSync, onClose, onDelete, canDelete, fields }) {
  const [draft, setDraft] = useState(/** @type {Record<string, unknown> | null} */ (null));
  /** Черновик строки «новый комментарий» по ключу поля (если несколько полей типа comments). */
  const [commentDraftByKey, setCommentDraftByKey] = useState(/** @type {Record<string, string>} */ ({}));
  const baselineJson = useRef('');
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /** Сериализованное состояние — стабильная зависимость для автосохранения (вложенные объекты, client и т.д.). */
  const draftJson = useMemo(() => (draft ? JSON.stringify(draft) : ''), [draft]);

  useLayoutEffect(() => {
    if (open && booking) {
      const d = clone(booking);
      setDraft(d);
      baselineJson.current = JSON.stringify(d);
      setCommentDraftByKey({});
    } else {
      setDraft(null);
      baselineJson.current = '';
      setCommentDraftByKey({});
    }
  }, [open, booking]);

  useEffect(() => {
    if (!open || !draftJson) return;
    const d = draftRef.current;
    if (!d) return;
    if (!booking || String(d.id) !== String(booking.id)) return;
    if (draftJson === baselineJson.current) return;
    try {
      void Promise.resolve(onSaveRef.current(d, { silent: true }));
      baselineJson.current = draftJson;
    } catch {
      /* toast в App */
    }
  }, [draftJson, open, booking]);

  const handleDismiss = useCallback(async () => {
    if (onFlushSync) await onFlushSync();
    onClose();
  }, [onFlushSync, onClose]);

  if (!open || !booking) return null;
  if (!draft || String(draft.id) !== String(booking.id)) return null;

  const visibleFields = [...(fields || [])]
    .filter((f) => f.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const titleField = visibleFields.find((f) => f.key === 'title');
  const listFields = visibleFields.filter((f) => f.key !== 'title');

  function patch(field, value) {
    setDraft((d) => ({ ...d, [field]: value, updatedAt: new Date().toISOString() }));
  }

  function patchClientField(fieldKey, partial) {
    setDraft((d) => ({
      ...d,
      [fieldKey]: normalizeClientFieldValue({
        ...normalizeClientFieldValue(d[fieldKey]),
        ...partial,
      }),
      updatedAt: new Date().toISOString(),
    }));
  }

  function toggleMulti(key, optionId) {
    setDraft((d) => {
      const raw = d[key];
      const arr = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
      const set = new Set(arr);
      if (set.has(optionId)) set.delete(optionId);
      else set.add(optionId);
      return { ...d, [key]: [...set], updatedAt: new Date().toISOString() };
    });
  }

  /**
   * @param {string} fieldKey
   * @param {string} [textOverride] — например из input при Enter, пока state черновика не успел обновиться
   */
  function addComment(fieldKey, textOverride) {
    const text = (textOverride ?? commentDraftByKey[fieldKey] ?? '').trim();
    if (!text) return;
    const c = { id: newId(), text, createdAt: new Date().toISOString() };
    setDraft((d) => ({
      ...d,
      [fieldKey]: [...(Array.isArray(d[fieldKey]) ? d[fieldKey] : []), c],
      updatedAt: new Date().toISOString(),
    }));
    setCommentDraftByKey((m) => ({ ...m, [fieldKey]: '' }));
  }

  /**
   * @param {string} fieldKey
   * @param {string} commentId
   */
  function removeComment(fieldKey, commentId) {
    setDraft((d) => ({
      ...d,
      [fieldKey]: (Array.isArray(d[fieldKey]) ? d[fieldKey] : []).filter((x) => x.id !== commentId),
      updatedAt: new Date().toISOString(),
    }));
  }

  /**
   * @param {any} f
   */
  function renderFieldValue(f) {
    const key = f.key;
    switch (f.type) {
      case 'text':
      case 'time':
        return (
          <input
            type="text"
            value={typeof draft[key] === 'string' ? draft[key] : ''}
            onChange={(e) => patch(key, e.target.value)}
            className={inputCls}
            placeholder={f.type === 'time' ? '12:00–13:00' : 'Пусто'}
          />
        );
      case 'textarea':
        return (
          <textarea
            value={typeof draft[key] === 'string' ? draft[key] : ''}
            onChange={(e) => patch(key, e.target.value)}
            rows={3}
            className={`${inputBordered} resize-y min-h-[72px]`}
            placeholder="Пусто"
          />
        );
      case 'number': {
        const n = Number(draft[key]);
        return (
          <MoneyIntInput
            value={Number.isFinite(n) ? n : 0}
            onChange={(next) => patch(key, next)}
          />
        );
      }
      case 'client':
        return (
          <ClientFieldInputs value={draft[key]} onChange={(next) => patchClientField(key, next)} />
        );
      case 'date':
        return (
          <BookingDateInput
            value={typeof draft[key] === 'string' ? draft[key] : ''}
            onChange={(ymd) => patch(key, ymd)}
            className={inputBordered}
          />
        );
      case 'email':
        return (
          <input
            type="email"
            value={typeof draft[key] === 'string' ? draft[key] : ''}
            onChange={(e) => patch(key, e.target.value)}
            className={inputCls}
            placeholder="name@example.com"
          />
        );
      case 'phone':
        return (
          <input
            type="tel"
            value={typeof draft[key] === 'string' ? draft[key] : ''}
            onChange={(e) => patch(key, e.target.value)}
            className={inputCls}
            placeholder="+7 …"
          />
        );
      case 'url':
        return (
          <input
            type="url"
            value={typeof draft[key] === 'string' ? draft[key] : ''}
            onChange={(e) => patch(key, e.target.value)}
            className={inputCls}
            placeholder="https://"
          />
        );
      case 'checkbox':
        return (
          <label className="inline-flex items-center gap-2 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={Boolean(draft[key])}
              onChange={(e) => patch(key, e.target.checked)}
              className="rounded border-notion-border bg-notion-bg text-violet-600 focus:ring-violet-500/40"
            />
            <span className="text-sm text-notion-muted">Да</span>
          </label>
        );
      case 'select': {
        const items = getFieldOptionItems(f);
        const cur = typeof draft[key] === 'string' ? draft[key] : '';
        return (
          <div className="flex flex-wrap gap-1.5">
            {items.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch(key, cur === opt.id ? '' : opt.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  cur === opt.id
                    ? `${notionPillClasses(opt.color)} ring-1 ring-white/25`
                    : 'border-notion-border text-notion-muted hover:bg-notion-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      }
      case 'multiselect': {
        const items = getFieldOptionItems(f);
        const raw = draft[key];
        const selected = new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []);
        return (
          <div className="flex flex-wrap gap-1.5">
            {items.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleMulti(key, opt.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  selected.has(opt.id)
                    ? `${notionPillClasses(opt.color)} ring-1 ring-white/25`
                    : 'border-notion-border text-notion-muted hover:bg-notion-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      }
      case 'status': {
        const items = getFieldOptionItems(f);
        const cur = typeof draft[f.key] === 'string' ? draft[f.key] : '';
        return (
          <div className="flex flex-wrap gap-1.5">
            {items.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch(f.key, cur === opt.id ? '' : opt.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  cur === opt.id
                    ? `${notionPillClasses(opt.color)} ring-1 ring-white/25`
                    : 'border-notion-border text-notion-muted hover:bg-notion-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      }
      case 'tags': {
        const items = getFieldOptionItems(f);
        const tagIds = Array.isArray(draft[f.key])
          ? draft[f.key].filter((x) => typeof x === 'string')
          : [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {items.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleMulti(f.key, opt.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  tagIds.includes(opt.id)
                    ? `${notionPillClasses(opt.color)} ring-1 ring-white/25`
                    : 'border-notion-border text-notion-muted hover:bg-notion-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      }
      case 'source': {
        const items = getFieldOptionItems(f);
        const cur = typeof draft[f.key] === 'string' ? draft[f.key] : '';
        return (
          <div className="flex flex-wrap gap-1.5">
            {items.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch(f.key, cur === opt.id ? '' : opt.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  cur === opt.id
                    ? `${notionPillClasses(opt.color)} ring-1 ring-white/25`
                    : 'border-notion-border text-notion-muted hover:bg-notion-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      }
      case 'comments': {
        const list = Array.isArray(draft[f.key]) ? draft[f.key] : [];
        return (
          <div className="space-y-3">
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {list.map((c) => (
                <li
                  key={c.id}
                  className="flex gap-2 items-start text-sm text-white/90 bg-notion-bg rounded-lg px-3 py-2 border border-notion-border/60"
                >
                  <div className="flex-1 min-w-0">
                    <div className="whitespace-pre-wrap break-words">{c.text}</div>
                    <div className="text-[10px] text-notion-muted mt-1">
                      {new Date(c.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeComment(f.key, c.id)}
                    className="shrink-0 p-1.5 rounded-md text-notion-muted hover:bg-rose-950/50 hover:text-rose-300 transition-colors touch-manipulation"
                    title="Удалить комментарий"
                    aria-label="Удалить комментарий"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={commentDraftByKey[f.key] ?? ''}
                onChange={(e) =>
                  setCommentDraftByKey((m) => ({
                    ...m,
                    [f.key]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  addComment(f.key, e.currentTarget.value);
                }}
                className={`flex-1 min-w-0 ${inputBordered}`}
                placeholder="Добавить комментарий…"
              />
              <button
                type="button"
                onClick={() => addComment(f.key)}
                className="px-3 py-2 rounded-lg border border-notion-border text-sm text-notion-muted hover:bg-notion-hover hover:text-white transition-colors shrink-0"
              >
                Добавить
              </button>
            </div>
          </div>
        );
      }
      default:
        return <span className="text-sm text-notion-muted">Пусто</span>;
    }
  }

  /** @param {any} f */
  function wrapField(f) {
    const { Icon } = getFieldTypeMeta(f.type, f.key);
    const IconOverride = iconComponentByKey(f.iconKey);
    const RowIcon = IconOverride || Icon;
    return (
      <PropertyRow key={f.id} Icon={RowIcon} label={f.label}>
        {renderFieldValue(f)}
      </PropertyRow>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4 bg-black/65 backdrop-blur-sm pt-[env(safe-area-inset-top)] sm:pt-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onClick={(e) => e.target === e.currentTarget && void handleDismiss()}
    >
      <div
        className="flex flex-col w-full max-w-4xl flex-1 min-h-0 sm:flex-none sm:h-auto sm:max-h-[min(90dvh,920px)] h-full overflow-hidden rounded-none sm:rounded-xl border-0 sm:border border-notion-border bg-notion-surface shadow-2xl pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-b border-notion-border shrink-0 bg-notion-surface z-10">
          <span id="booking-modal-title" className="sr-only">
            {typeof draft.title === 'string' && draft.title.trim() ? draft.title : 'Запись'}
          </span>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            className="p-2 rounded-md text-notion-muted hover:bg-notion-hover hover:text-white shrink-0 touch-manipulation"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-1 overscroll-contain">
          {titleField ? (
            <div className="pb-4 mb-2 border-b border-notion-border/60">
              <input
                type="text"
                value={typeof draft.title === 'string' ? draft.title : ''}
                onChange={(e) => patch('title', e.target.value)}
                className="w-full text-xl sm:text-2xl font-semibold bg-transparent border-0 outline-none focus:ring-0 text-white placeholder:text-notion-muted/45 px-0"
                placeholder="Название"
              />
            </div>
          ) : null}

          {listFields.map((f) => (
            <div key={f.id}>{wrapField(f)}</div>
          ))}

          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap gap-2 pt-6 mt-4 border-t border-notion-border">
            {canDelete ? (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Удалить эту запись?')) return;
                  try {
                    await Promise.resolve(onDelete(booking.id));
                    onClose();
                  } catch {
                    /* toast в App */
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg text-sm text-red-300 hover:bg-red-950/40 sm:ml-auto transition-colors touch-manipulation"
              >
                Удалить
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

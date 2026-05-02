import { useLayoutEffect, useRef } from 'react';
import {
  formatRu7Progressive,
  nationalDigitsLeftOfCaret,
  parseRuPhoneDigits,
  ruPhoneCaretIndex,
} from '@/lib/ruPhoneMask';
import { normalizeClientFieldValue } from '@/lib/clientField';

const subInput =
  'w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-notion-fg placeholder:text-notion-muted focus:outline-none focus:ring-2 focus:ring-brand/45';

/**
 * @param {object} p
 * @param {unknown} p.value
 * @param {(next: { name: string, phone: string }) => void} p.onChange
 */
export function ClientFieldInputs({ value, onChange }) {
  const { name, phone } = normalizeClientFieldValue(value);
  const display = formatRu7Progressive(phone);
  const inputRef = useRef(null);
  const selRef = useRef(/** @type {{ start: number, end: number } | null} */ (null));

  useLayoutEffect(() => {
    const el = inputRef.current;
    const sel = selRef.current;
    if (!el || !sel) return;
    const max = el.value.length;
    const start = Math.min(sel.start, max);
    const end = Math.min(sel.end, max);
    el.setSelectionRange(start, end);
    selRef.current = null;
  }, [display]);

  return (
    <div className="space-y-2.5 w-full min-w-0">
      <label className="block">
        <span className="text-[11px] text-notion-muted/90 uppercase tracking-wide">Имя</span>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value, phone })}
          className={`mt-1 ${subInput}`}
          placeholder="Имя клиента"
          autoComplete="name"
        />
      </label>
      <label className="block">
        <span className="text-[11px] text-notion-muted/90 uppercase tracking-wide">Телефон</span>
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={display}
          onKeyDown={(e) => {
            if (e.key !== 'Backspace') return;
            const el = inputRef.current;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            if (start == null || end == null || start !== end || start < 1) return;
            const v = el.value;
            const ch = v[start - 1];
            if (/\d/.test(ch)) return;
            const natBefore = nationalDigitsLeftOfCaret(v, start);
            if (natBefore < 1) return;
            e.preventDefault();
            const next = phone.slice(0, natBefore - 1) + phone.slice(natBefore);
            const nextDisplay = formatRu7Progressive(next);
            const nextCaret = ruPhoneCaretIndex(nextDisplay, natBefore - 1);
            selRef.current = { start: nextCaret, end: nextCaret };
            onChange({ name, phone: next });
          }}
          onChange={(e) => {
            const el = e.target;
            const raw = el.value;
            const pos = el.selectionStart ?? raw.length;
            if (el.selectionStart == null) {
              onChange({ name, phone: parseRuPhoneDigits(raw) });
              return;
            }
            let nationalBefore = nationalDigitsLeftOfCaret(raw, pos);
            const nextDigits = parseRuPhoneDigits(raw);
            nationalBefore = Math.min(nationalBefore, nextDigits.length);
            const nextDisplay = formatRu7Progressive(nextDigits);
            const nextCaret = ruPhoneCaretIndex(nextDisplay, nationalBefore);
            selRef.current = { start: nextCaret, end: nextCaret };
            onChange({ name, phone: nextDigits });
          }}
          className={`mt-1 ${subInput} font-mono tabular-nums tracking-tight`}
          placeholder="+7 (***) ***-**-**"
        />
      </label>
    </div>
  );
}

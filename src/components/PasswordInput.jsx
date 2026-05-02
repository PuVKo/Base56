import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const INPUT_CLASS =
  'input w-full py-2 pl-3 pr-10 outline-none focus:ring-1 focus:ring-[color:var(--accent)]/40';

/**
 * @param {{
 *   id: string;
 *   value: string;
 *   onChange: (e: import('react').ChangeEvent<HTMLInputElement>) => void;
 *   autoComplete?: string;
 *   required?: boolean;
 *   minLength?: number;
 * }} props
 */
export function PasswordInput({ id, value, onChange, autoComplete, required, minLength }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        className={INPUT_CLASS}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        className="login-eye absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 outline-none text-[color:var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]/40"
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

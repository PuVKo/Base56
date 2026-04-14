import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const INPUT_CLASS =
  'w-full rounded-lg border border-notion-border bg-notion-bg py-2 pl-3 pr-10 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50';

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
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-notion-muted hover:bg-notion-border/30 hover:text-white outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

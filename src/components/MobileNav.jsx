import { MAIN_VIEWS } from '@/navConfig';

/**
 * @param {{
 *   activeView: string,
 *   onViewChange: (id: string) => void,
 * }} props
 */
export function MobileNav({ activeView, onViewChange }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-center gap-0 border-t border-[color:var(--border)] bg-[var(--bg-elev-1)]/95 backdrop-blur-md pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.2)] pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))]"
      aria-label="Основная навигация"
    >
      <div className="flex min-w-0 w-full max-w-full flex-1 items-stretch justify-around gap-0.5 px-0.5">
        {MAIN_VIEWS.map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-2 px-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors touch-manipulation ${
              activeView === id
                ? 'text-[color:var(--accent)] bg-[var(--accent-soft)]'
                : 'text-[color:var(--text-muted)] active:bg-[var(--surface-hover)]'
            }`}
          >
            <Icon className={`w-5 h-5 shrink-0 stroke-[1.75] ${activeView === id ? 'opacity-100' : 'opacity-70'}`} />
            <span className="truncate max-w-full sm:hidden">{shortLabel}</span>
            <span className="truncate max-w-full hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

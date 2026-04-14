import { MAIN_VIEWS } from '@/navConfig';

/**
 * @param {{ activeView: string, onViewChange: (id: string) => void }} props
 */
export function MobileNav({ activeView, onViewChange }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around gap-0.5 border-t border-notion-border bg-notion-surface/95 backdrop-blur-md px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.35)]"
      aria-label="Основная навигация"
    >
      {MAIN_VIEWS.map(({ id, label, shortLabel, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onViewChange(id)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-2 px-1 rounded-lg text-[10px] font-medium transition-colors touch-manipulation ${
            activeView === id
              ? 'text-violet-300 bg-violet-500/15'
              : 'text-notion-muted active:bg-notion-hover'
          }`}
        >
          <Icon className={`w-5 h-5 shrink-0 ${activeView === id ? 'opacity-100' : 'opacity-70'}`} />
          <span className="truncate max-w-full sm:hidden">{shortLabel}</span>
          <span className="truncate max-w-full hidden sm:inline">{label}</span>
        </button>
      ))}
    </nav>
  );
}

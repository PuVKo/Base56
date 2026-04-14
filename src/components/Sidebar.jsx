import { CreditCard, PanelLeft, Settings } from 'lucide-react';
import { MAIN_VIEWS } from '@/navConfig';

/**
 * @param {{ login?: string | null, email?: string | null }} user
 */
function profileInitials(user) {
  const login = user.login?.trim();
  if (login && login.length >= 2) return login.slice(0, 2).toUpperCase();
  if (login) return login.slice(0, 1).toUpperCase();
  const local = user.email?.split('@')[0]?.trim() || '';
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return (local[0] || '?').toUpperCase();
}

/**
 * @param {object} props
 * @param {{ id: string, email: string, login?: string | null } | null} [props.currentUser]
 * @param {() => void} [props.onOpenProfileSettings] — открыть настройки на вкладке «Профиль»
 */
export function Sidebar({ activeView, onViewChange, onOpenProfileSettings, open, onCollapse, currentUser }) {
  if (!open) return null;

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r border-notion-border bg-notion-surface/80 flex-col min-h-0 h-full self-stretch">
      <div className="p-3 border-b border-notion-border space-y-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-violet-500/20 flex items-center justify-center text-violet-300 text-sm font-semibold shrink-0">
            PC
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-white truncate">Base56</div>
            <div className="text-[11px] text-notion-muted leading-snug line-clamp-2">
              Рабочий календарь для специалистов
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="flex w-full items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white transition-colors text-xs font-medium"
          title="Свернуть боковое меню"
          aria-label="Свернуть боковое меню"
        >
          <PanelLeft className="w-3.5 h-3.5 shrink-0 opacity-90" />
          Свернуть
        </button>
      </div>
      <nav className="p-2 flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {MAIN_VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
              activeView === id
                ? 'bg-white/10 text-white'
                : 'text-notion-muted hover:bg-notion-hover hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0 opacity-80" />
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-auto shrink-0 border-t border-notion-border flex flex-col gap-0 bg-notion-surface/95">
        {currentUser ? (
          <button
            type="button"
            onClick={() => onOpenProfileSettings?.()}
            className="w-full text-left p-3 flex items-start gap-2.5 rounded-none hover:bg-notion-hover/50 transition-colors group/profile"
            title="Профиль"
            aria-label="Профиль"
          >
            <div className="w-9 h-9 rounded-full bg-violet-500/25 border border-violet-500/35 flex items-center justify-center text-violet-200 text-[11px] font-semibold tracking-tight shrink-0 ring-1 ring-white/5">
              {profileInitials(currentUser)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-sm font-medium text-white truncate">
                  {currentUser.login || currentUser.email?.split('@')[0] || 'Профиль'}
                </span>
                <Settings className="w-3.5 h-3.5 text-notion-muted opacity-0 group-hover/profile:opacity-100 shrink-0 ml-auto" aria-hidden />
              </div>
              <div className="text-[11px] text-notion-muted/85 truncate mt-0.5" title={currentUser.email}>
                {currentUser.email}
              </div>
            </div>
          </button>
        ) : null}
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-notion-muted border-t border-notion-border/60">
          <CreditCard className="w-3.5 h-3.5 shrink-0 opacity-80" />
          <span>Оплаты — скоро</span>
        </div>
      </div>
    </aside>
  );
}

import { ChevronLeft } from 'lucide-react';
import { SettingsThemeToggle } from '@/components/ThemeToggle.jsx';
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
 * @param {() => void} [props.onOpenProfileSettings]
 * @param {boolean} props.collapsed
 * @param {() => void} props.onToggleCollapse
 * @param {import('@/lib/galleryPrefsModel').ClientUiPayload} props.clientUi
 * @param {(fn: (prev: import('@/lib/galleryPrefsModel').ClientUiPayload) => import('@/lib/galleryPrefsModel').ClientUiPayload) => void} props.updateClientUi
 */
export function Sidebar({
  activeView,
  onViewChange,
  onOpenProfileSettings,
  collapsed,
  onToggleCollapse,
  currentUser,
  clientUi,
  updateClientUi,
}) {
  return (
    <aside className="sidebar hidden md:flex min-h-0 h-full self-stretch flex-col">
      <div className="sidebar-brand">
        <div className="brand-mark">B56</div>
        <div className="brand-text">
          <span className="brand-name">Base56</span>
          <span className="brand-tag">Календарь для специалистов</span>
        </div>
      </div>

      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={onToggleCollapse}
        title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
      >
        <ChevronLeft
          size={14}
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
        {!collapsed ? <span className="collapse-text">Свернуть</span> : null}
      </button>

      <nav className="nav">
        {MAIN_VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${activeView === id ? 'active' : ''}`}
            onClick={() => onViewChange(id)}
          >
            <Icon size={16} strokeWidth={1.75} />
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-theme flex items-center justify-start">
          <SettingsThemeToggle
            clientUi={clientUi}
            updateClientUi={updateClientUi}
            variant={collapsed ? 'toggle' : 'sidebar'}
          />
        </div>
        {currentUser ? (
          <button
            type="button"
            className="sidebar-user"
            onClick={() => onOpenProfileSettings?.()}
            title={
              collapsed
                ? currentUser.email || currentUser.login || 'Профиль'
                : 'Профиль'
            }
          >
            <div className="user-avatar">{profileInitials(currentUser)}</div>
            <div className="user-info">
              <span className="user-name">
                {currentUser.login || currentUser.email?.split('@')[0] || 'Профиль'}
              </span>
              <span className="user-email" title={currentUser.email ?? ''}>
                {currentUser.email}
              </span>
            </div>
          </button>
        ) : null}
      </div>
    </aside>
  );
}

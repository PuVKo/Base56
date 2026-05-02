export const THEME_STORAGE_KEY = 'base56-theme';

/** @returns {'dark' | 'light' | null} */
export function readStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {'dark' | 'light'} theme */
export function writeStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** @param {'dark' | 'light'} theme */
export function applyDomTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(t);
  document.documentElement.dataset.theme = t;
  writeStoredTheme(t);
}

/**
 * Если на сервере нет сохранённой темы — берём из localStorage (выбор до входа).
 * @param {import('@/lib/galleryPrefsModel').ClientUiPayload} merged
 * @param {boolean} [persisted]
 * @param {unknown} rawServerUi
 */
export function mergeClientUiThemeFromLs(merged, persisted, rawServerUi) {
  const raw = rawServerUi && typeof rawServerUi === 'object' ? /** @type {Record<string, unknown>} */ (rawServerUi) : {};
  const serverHasTheme = persisted === true && (raw.theme === 'light' || raw.theme === 'dark');
  if (serverHasTheme) return merged;
  const ls = readStoredTheme();
  if (ls === 'light' || ls === 'dark') return { ...merged, theme: ls };
  return merged;
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Выезжающая справа панель поверх контента (портал в body).
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {string} [p.title] — если задан custom header, можно не передавать
 * @param {import('react').ReactNode} [p.header] — заменяет строку заголовка (title + крестик)
 * @param {string} [p.panelClassName] — доп. классы панели (например max-w-full на мобилке)
 * @param {import('react').ReactNode} p.children
 */
export function FloatingSidePanel({ open, onClose, title, header, panelClassName, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="floating-side-panel-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Закрыть панель"
        onClick={onClose}
      />
      <div
        className={`relative flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col border-l border-notion-border bg-notion-bg shadow-2xl animate-[slideIn_.2s_ease-out] ${panelClassName ?? ''}`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0.96; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
        {header ? (
          <div className="shrink-0 border-b border-notion-border">{header}</div>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-notion-border px-4 py-3 shrink-0">
            <h2 id="floating-side-panel-title" className="text-base font-semibold text-notion-fg truncate">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-notion-border p-2 text-notion-muted hover:bg-notion-hover hover:text-notion-fg transition-colors shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

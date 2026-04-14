/**
 * Список чекбоксов видимости полей (плитка / карточка календаря / столбцы таблицы).
 * @param {object} p
 * @param {any[] | undefined} p.fields
 * @param {Record<string, boolean>} p.tileVisible
 * @param {string} p.title
 * @param {string} p.description
 * @param {(fieldId: string, visible: boolean) => void} p.onToggleField
 * @param {boolean} [p.embedded] в выезжающей панели — компактная оболочка
 */
export function TileFieldsPanel({ fields, tileVisible, title, description, onToggleField, embedded = false }) {
  const fieldsSorted = [...(fields || [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const shell = embedded
    ? 'rounded-lg border border-notion-border/60 bg-notion-surface/50 p-3 sm:p-4'
    : 'rounded-xl border border-notion-border/80 bg-notion-surface/80 p-3 sm:p-4';

  return (
    <div className={shell}>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="text-xs text-notion-muted mt-1 leading-relaxed">{description}</p>
      <ul className="mt-3 space-y-2 max-h-[min(60vh,28rem)] overflow-y-auto pr-1">
        {fieldsSorted.map((f) => (
          <li key={f.id}>
            <label className="flex items-start gap-2 cursor-pointer text-sm text-notion-muted hover:text-white">
              <input
                type="checkbox"
                className="rounded border-notion-border mt-0.5 shrink-0"
                checked={tileVisible[f.id] !== false}
                onChange={(e) => {
                  onToggleField(f.id, e.target.checked);
                }}
              />
              <span>
                <span className="text-white/90">{f.label}</span>
                <span className="block text-[11px] text-notion-muted/80 mt-0.5">{f.key}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

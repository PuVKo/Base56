import { MessageSquare } from 'lucide-react';
import { formatClientDisplay } from '@/lib/clientField';
import { formatDateDdMm, formatRub } from '@/lib/format';
import { getFieldOptionItems, pillDisplayForField, tagPillFromFieldOrConstants } from '@/lib/fieldOptions';
import { notionPillClasses } from '@/lib/notionColors';

/** Как на событии календаря: `.chip` + `.chip-tag` из mockup-base + notionPillClasses из поля */
const TILE_CHIP_CLASS = 'chip chip-tag max-w-full min-w-0';

/**
 * Компактное значение поля на плитке (только для списка настроенных полей).
 * @param {any} field
 * @param {Record<string, unknown>} booking
 * @param {any[] | undefined} fields
 * @param {any | undefined} tagsField — поле тегов для резолва id
 * @param {{ hasVisibleStandardDateField: boolean }} ctx
 */
function renderFieldBlock(field, booking, fields, tagsField, ctx) {
  const key = field.key;
  const raw = booking[key];

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url': {
      const s = typeof raw === 'string' ? raw.trim() : '';
      if (!s) return null;
      return <p className="text-[12px] text-notion-fg/80 line-clamp-2 break-words leading-snug">{s}</p>;
    }
    case 'textarea': {
      const s = typeof raw === 'string' ? raw.trim() : '';
      if (!s) return null;
      return <p className="text-[12px] text-notion-fg/80 line-clamp-2 break-words leading-relaxed">{s}</p>;
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n) && key !== 'amount') return null;
      if (key === 'amount') {
        return (
          <div className="text-[15px] font-semibold tabular-nums leading-none tracking-tight text-[color:var(--accent)]">
            {formatRub(Number.isFinite(n) ? n : 0)}
          </div>
        );
      }
      return <p className="text-[12px] text-notion-muted tabular-nums">{Number.isFinite(n) ? String(n) : '—'}</p>;
    }
    case 'date': {
      const s = typeof raw === 'string' ? raw.trim() : '';
      const tr =
        key === 'date' && typeof booking.timeRange === 'string' ? booking.timeRange.trim() : '';
      const dd = formatDateDdMm(s);
      if (!dd && !tr) return null;
      return (
        <div className="text-[13px] sm:text-[14px] font-medium tabular-nums text-notion-fg/90">
          {dd ? (
            <>
              {dd}
              {tr ? ` · ${tr}` : ''}
            </>
          ) : (
            tr || null
          )}
        </div>
      );
    }
    case 'time': {
      const s = typeof raw === 'string' ? raw.trim() : '';
      if (key === 'timeRange' && ctx.hasVisibleStandardDateField) {
        return null;
      }
      if (key === 'timeRange') {
        const dateStr = typeof booking.date === 'string' ? booking.date.trim() : '';
        const dd = formatDateDdMm(dateStr);
        if (dd && s) {
          return (
            <div className="text-[13px] sm:text-[14px] font-medium tabular-nums text-notion-fg/90">
              {dd} · {s}
            </div>
          );
        }
        if (!s) return null;
        return <div className="text-[13px] sm:text-[14px] font-medium tabular-nums text-notion-fg/90">{s}</div>;
      }
      if (!s) return null;
      return <div className="text-[13px] sm:text-[14px] font-medium tabular-nums text-notion-fg/90">{s}</div>;
    }
    case 'checkbox': {
      return <span className="text-[12px] text-notion-muted">{raw ? 'Да' : 'Нет'}</span>;
    }
    case 'select':
    case 'status':
    case 'source': {
      const pill = pillDisplayForField(fields, key, typeof raw === 'string' ? raw : '');
      if (field.type === 'source' || key === 'sourceId') {
        if (!pill.label) return null;
        return <span className={`${TILE_CHIP_CLASS} ${pill.className}`}>{pill.label}</span>;
      }
      return <span className={`${TILE_CHIP_CLASS} ${pill.className}`}>{pill.label}</span>;
    }
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
      if (!arr.length) return null;
      const items = getFieldOptionItems(field);
      return (
        <div className="flex flex-wrap gap-[3px]">
          {arr.map((id) => {
            const opt = items.find((x) => x.id === id);
            const cls = opt ? notionPillClasses(opt.color || 'gray') : notionPillClasses('gray');
            const label = opt?.label ?? id;
            return (
              <span key={id} className={`${TILE_CHIP_CLASS} ${cls}`}>
                {label}
              </span>
            );
          })}
        </div>
      );
    }
    case 'tags': {
      const arr = Array.isArray(booking.tagIds) ? booking.tagIds.filter((x) => typeof x === 'string') : [];
      if (!arr.length) return null;
      return (
        <div className="flex flex-wrap gap-[3px]">
          {arr.map((tid) => {
            const pill = tagPillFromFieldOrConstants(tagsField, tid);
            if (!pill) return null;
            return (
              <span key={tid} className={`${TILE_CHIP_CLASS} ${pill.className}`}>
                {pill.label}
              </span>
            );
          })}
        </div>
      );
    }
    case 'client': {
      const line = formatClientDisplay(raw);
      if (!line) return null;
      return (
        <span className="inline-flex max-w-full min-w-0 items-center text-[12px] leading-snug text-amber-200/80">
          Клиент: {line}
        </span>
      );
    }
    case 'comments': {
      const list = Array.isArray(raw) ? raw : [];
      if (!list.length) return null;
      return (
        <div
          className="flex items-center gap-1 text-[12px] text-notion-muted tabular-nums"
          aria-label={`${list.length} комментариев`}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {list.length}
        </div>
      );
    }
    default: {
      if (raw === undefined || raw === null || raw === '') return null;
      if (typeof raw === 'object') {
        return <p className="text-[12px] text-notion-muted line-clamp-2">{JSON.stringify(raw)}</p>;
      }
      return <p className="text-[12px] text-notion-muted line-clamp-2">{String(raw)}</p>;
    }
  }
}

/**
 * Заголовок (название) — всегда отдельно, крупнее.
 */
function TitleBlock({ field, booking, compact }) {
  const raw = booking[field.key];
  const s = typeof raw === 'string' ? raw.trim() : '';
  return (
    <div
      className={
        compact
          ? 'font-medium text-notion-fg line-clamp-2 leading-snug text-[12px] sm:text-[13px]'
          : 'tile-title line-clamp-2'
      }
    >
      {s || 'Без названия'}
    </div>
  );
}

/** Полная ширина — длинный текст и блоки с несколькими бейджами; остальное в потоке flex-wrap как в календаре. */
function isTileFieldFullWidth(field) {
  const t = field.type;
  const compactInline = new Set([
    'date',
    'time',
    'number',
    'checkbox',
    'select',
    'status',
    'source',
    'client',
  ]);
  if (compactInline.has(t)) return false;
  return true;
}

const PROSE_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'url']);
/** Числовые поля кроме суммы — строкой в блоке описания */
function isProseNumberField(field) {
  return field.type === 'number' && field.key !== 'amount';
}

/**
 * Порядок секций как в Notion: мета → текст → бейджи → клиент → комментарии (сумма отдельно в подвале).
 * @param {any[]} fields — после исключения date/time и amount
 */
function partitionGalleryMiddleFields(fields) {
  /** @type {any[]} */
  const prose = [];
  /** @type {any[]} */
  const chips = [];
  /** @type {any[]} */
  const client = [];
  /** @type {any[]} */
  const comments = [];
  for (const f of fields) {
    if (f.type === 'client') {
      client.push(f);
      continue;
    }
    if (f.type === 'comments') {
      comments.push(f);
      continue;
    }
    if (PROSE_TYPES.has(f.type) || isProseNumberField(f)) {
      prose.push(f);
      continue;
    }
    chips.push(f);
  }
  return { prose, chips, client, comments };
}

/**
 * @param {object} p
 * @param {Record<string, unknown>} p.booking
 * @param {any[]} p.fields
 * @param {Record<string, boolean>} p.galleryTileFieldVisible
 * @param {boolean} [p.compact] — компактный вид (календарь)
 */
export function GalleryTileBookingContent({ booking, fields, galleryTileFieldVisible, compact }) {
  const tagsField = fields?.find((f) => f.type === 'tags' || f.key === 'tagIds');
  const visibleFields = [...(fields || [])]
    .filter((f) => f.visible)
    .filter((f) => galleryTileFieldVisible[f.id] !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const titleField = visibleFields.find((f) => f.key === 'title');
  const rest = visibleFields.filter((f) => f.key !== 'title');
  const amountFields = rest.filter((f) => f.type === 'number' && f.key === 'amount');
  const middleRest = rest.filter((f) => !(f.type === 'number' && f.key === 'amount'));
  const dateTimeFields = middleRest.filter((f) => f.type === 'date' || f.type === 'time');
  const afterDateTimeFields = middleRest.filter((f) => f.type !== 'date' && f.type !== 'time');
  const ctx = {
    hasVisibleStandardDateField: middleRest.some((f) => f.type === 'date' && f.key === 'date'),
  };
  const hasAmount = amountFields.length > 0;

  /** @param {any} field */
  function wrapMiddleField(field) {
    const block = renderFieldBlock(field, booking, fields, tagsField, ctx);
    if (!block) return null;
    const full = isTileFieldFullWidth(field);
    return (
      <div
        key={field.id}
        className={
          full
            ? 'min-w-0 w-full basis-full shrink-0'
            : 'min-w-0 max-w-full shrink-0 grow-0 basis-auto'
        }
      >
        {block}
      </div>
    );
  }

  const dateTimeNodes = dateTimeFields.map((field) => wrapMiddleField(field)).filter(Boolean);
  const afterDateTimeNodes = afterDateTimeFields.map((field) => wrapMiddleField(field)).filter(Boolean);

  function blockContent(field) {
    return renderFieldBlock(field, booking, fields, tagsField, ctx);
  }

  if (!compact) {
    const { prose, chips, client, comments } = partitionGalleryMiddleFields(afterDateTimeFields);
    const hasComments = comments.length > 0;

    return (
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        {titleField ? (
          <TitleBlock field={titleField} booking={booking} compact={false} />
        ) : (
          <div className="tile-title line-clamp-2">
            {typeof booking.title === 'string' && booking.title.trim() ? booking.title : 'Без названия'}
          </div>
        )}

        {dateTimeFields.length > 0 ? (
          <div className="tile-meta flex flex-wrap items-center gap-x-2 gap-y-1">
            {dateTimeFields.map((field) => {
              const block = blockContent(field);
              if (!block) return null;
              return (
                <div key={field.id} className="min-w-0">
                  {block}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          {prose.length > 0 ? (
            <div className="flex min-w-0 w-full flex-col gap-1.5">
              {prose.map((field) => {
                const block = blockContent(field);
                if (!block) return null;
                return (
                  <div key={field.id} className="tile-desc min-w-0 w-full">
                    {block}
                  </div>
                );
              })}
            </div>
          ) : null}

          {chips.length > 0 ? (
            <div className="tile-tags min-w-0 w-full">
              <div className="flex flex-wrap content-start items-start gap-[3px]">
                {chips.map((field) => {
                  const block = blockContent(field);
                  if (!block) return null;
                  const fullRow = field.type === 'multiselect' || field.type === 'tags';
                  return (
                    <div
                      key={field.id}
                      className={
                        fullRow
                          ? 'w-full min-w-0 shrink-0 basis-full'
                          : 'max-w-full min-w-0 shrink-0 basis-auto'
                      }
                    >
                      {block}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {client.map((field) => {
            const block = blockContent(field);
            if (!block) return null;
            return (
              <div key={field.id} className="min-w-0 w-full">
                {block}
              </div>
            );
          })}
        </div>

        {hasAmount ? (
          <div className="tile-foot mt-auto flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 flex flex-col items-start gap-0.5">
              {amountFields.map((field) => {
                const block = blockContent(field);
                if (!block) return null;
                return (
                  <div key={field.id} className="tile-amount text-left">
                    {block}
                  </div>
                );
              })}
            </div>
            {hasComments ? (
              <div className="min-w-0 flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                {comments.map((field) => {
                  const block = blockContent(field);
                  if (!block) return null;
                  return (
                    <div key={field.id} className="min-w-0">
                      {block}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : hasComments ? (
          <div className="tile-foot mt-auto flex shrink-0 flex-wrap items-center gap-2">
            {comments.map((field) => {
              const block = blockContent(field);
              if (!block) return null;
              return (
                <div key={field.id} className="min-w-0">
                  {block}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${compact ? 'gap-1' : 'gap-1.5'} ${compact ? 'text-[11px] sm:text-[12px]' : ''}`}
    >
      {titleField ? (
        <TitleBlock field={titleField} booking={booking} compact={compact} />
      ) : (
        <div
          className={`font-medium text-notion-fg line-clamp-2 leading-snug ${compact ? 'text-[12px] sm:text-[13px]' : ''}`}
        >
          {typeof booking.title === 'string' && booking.title.trim() ? booking.title : 'Без названия'}
        </div>
      )}
      <div className={`mt-0.5 flex min-h-0 flex-col gap-1.5 ${hasAmount ? 'flex-1' : ''}`}>
        <div className={`flex flex-col gap-1.5 w-full min-w-0 ${hasAmount ? 'flex-1' : ''}`}>
          {dateTimeNodes.length > 0 ? (
            <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 items-center content-start w-full min-w-0">
              {dateTimeNodes}
            </div>
          ) : null}
          {afterDateTimeNodes.length > 0 ? (
            <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 items-center content-start w-full min-w-0">
              {afterDateTimeNodes}
            </div>
          ) : null}
        </div>
        {hasAmount ? (
          <div className="mt-auto w-full shrink-0 border-t border-notion-border/25 pt-1.5">
            {amountFields.map((field) => {
              const block = renderFieldBlock(field, booking, fields, tagsField, ctx);
              if (!block) return null;
              return (
                <div key={field.id} className="min-w-0 w-full">
                  {block}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

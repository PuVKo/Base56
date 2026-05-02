import { pillDisplayForField, tagPillFromFieldOrConstants } from '@/lib/fieldOptions';
import { cn } from '@/lib/utils';

/** @param {string} status */
export function mapBookingStatusToMockup(status) {
  if (status === 'done') return 'done';
  if (status === 'processing') return 'progress';
  return 'pending';
}

const STATUS_LABEL_FALLBACK = {
  done: 'Завершён',
  progress: 'Обрабатывается',
  pending: 'Не выбран',
};

/**
 * Статус: без `className` — прежние CSS-токены макета; с `className` — цвета из настроек поля (БД).
 * @param {{ status: string, label?: string, className?: string }} p
 */
export function StatusChip({ status, label, className }) {
  const m = mapBookingStatusToMockup(status);
  const text = label || STATUS_LABEL_FALLBACK[m] || status;
  if (className) {
    return <span className={cn('chip chip-tag', className)}>{text}</span>;
  }
  return <span className={`chip chip-status-${m}`}>{text}</span>;
}

/**
 * @param {{ name: string, neutral?: boolean, className?: string }} p
 */
export function SourceChip({ name, neutral, className }) {
  if (className) {
    return <span className={cn('chip chip-tag', className)}>{name}</span>;
  }
  return (
    <span className={`chip chip-tag ${neutral ? 'chip-source-neutral' : 'chip-source'}`}>{name}</span>
  );
}

/**
 * Status chip using field definition label и цвет варианта из настроек поля (как в модалке / плитке).
 * @param {{ fields: unknown[] | undefined, status: string }} p
 */
export function BookingStatusChip({ fields, status }) {
  const pill = pillDisplayForField(fields, 'status', status);
  return <StatusChip status={status} label={pill.label} className={pill.className} />;
}

/**
 * @param {{ fields: unknown[] | undefined, sourceId: string }} p
 */
export function BookingSourceChip({ fields, sourceId }) {
  const pill = pillDisplayForField(fields, 'sourceId', sourceId);
  if (!pill.label) return <SourceChip name="Без источника" neutral />;
  return <SourceChip name={pill.label} className={pill.className} />;
}

/**
 * Теги: цвет и подпись из вариантов поля в БД (без угадывания photo/video по тексту).
 * @param {{ fields: unknown[] | undefined, tagIds: string[] }} p
 */
export function BookingTagChips({ fields, tagIds }) {
  const tagsField = fields?.find((f) => f.key === 'tagIds' || f.type === 'tags');
  return (
    <>
      {(tagIds || []).map((id) => {
        const pill = tagPillFromFieldOrConstants(tagsField, id);
        if (!pill) return null;
        return (
          <span key={id} className={cn('chip chip-tag', pill.className)}>
            {pill.label}
          </span>
        );
      })}
    </>
  );
}

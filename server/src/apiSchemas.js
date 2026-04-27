import { z } from 'zod';

/** Совпадает с ADDABLE_FIELD_TYPES в index.js — только типы, которые можно создать через POST. */
const FIELD_CREATE_TYPE_ENUM = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'email',
  'phone',
  'client',
  'url',
  'checkbox',
  'select',
  'multiselect',
]);

const COLOR_ENUM = z.enum(['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']);

const optionItemSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(200),
    color: COLOR_ENUM,
  })
  .strict();

const optionsPayloadSchema = z
  .object({
    items: z.array(optionItemSchema).min(1).max(200),
  })
  .strict();

const cuidLike = z.string().min(15).max(40).regex(/^[a-z0-9_-]+$/i);

const commentItemSchema = z
  .object({
    id: z.string().max(40),
    text: z.string().max(10_000),
    createdAt: z.string().max(40),
  })
  .strict();

const clientNameSchema = z
  .object({
    name: z.string().max(500).optional(),
    phone: z.string().max(40).optional(),
  })
  .strict();

/** Значения в JSON `Booking.data` (без глубокой вложенности объектов). */
const bookingLeafValue = z.union([
  z.string().max(20_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(200)).max(200),
  z.array(commentItemSchema).max(500),
  clientNameSchema,
]);

const MAX_BOOKING_EXTRA_KEYS = 70;

const bookingCreateSchema = z
  .object({
    id: cuidLike,
    createdAt: z.string().max(40).optional(),
    updatedAt: z.string().max(40).optional(),
  })
  .catchall(bookingLeafValue)
  .superRefine((obj, ctx) => {
    const reserved = new Set(['id', 'createdAt', 'updatedAt']);
    const n = Object.keys(obj).filter((k) => !reserved.has(k)).length;
    if (n > MAX_BOOKING_EXTRA_KEYS) {
      ctx.addIssue({ code: 'custom', message: 'Слишком много полей в записи' });
    }
  });

const bookingUpdateSchema = z
  .object({
    id: cuidLike.optional(),
    createdAt: z.string().max(40).optional(),
    updatedAt: z.string().max(40).optional(),
  })
  .catchall(bookingLeafValue)
  .superRefine((obj, ctx) => {
    const reserved = new Set(['id', 'createdAt', 'updatedAt']);
    const n = Object.keys(obj).filter((k) => !reserved.has(k)).length;
    if (n > MAX_BOOKING_EXTRA_KEYS) {
      ctx.addIssue({ code: 'custom', message: 'Слишком много полей в записи' });
    }
  });

export function parseBookingCreateBody(body) {
  const r = bookingCreateSchema.safeParse(body);
  if (!r.success) return { ok: false, error: 'Некорректное тело запроса записи' };
  return { ok: true, data: r.data };
}

export function parseBookingUpdateBody(body) {
  const r = bookingUpdateSchema.safeParse(body);
  if (!r.success) return { ok: false, error: 'Некорректное тело запроса записи' };
  return { ok: true, data: r.data };
}

const fieldCreateSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    type: FIELD_CREATE_TYPE_ENUM,
    visible: z.boolean().optional(),
    iconKey: z.union([z.string().trim().max(80), z.null()]).optional(),
    options: optionsPayloadSchema.optional(),
  })
  .strict();

const fieldPatchSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    visible: z.boolean().optional(),
    sortOrder: z.number().int().finite().optional(),
    iconKey: z.union([z.string().trim().max(80), z.null()]).optional(),
    options: optionsPayloadSchema.optional(),
  })
  .strict();

const fieldReorderSchema = z
  .object({
    ids: z.array(cuidLike).min(1).max(200),
  })
  .strict();

export function parseFieldCreateBody(body) {
  const r = fieldCreateSchema.safeParse(body);
  if (!r.success) return { ok: false, error: 'Некорректное тело запроса поля' };
  return { ok: true, data: r.data };
}

export function parseFieldPatchBody(body) {
  const r = fieldPatchSchema.safeParse(body);
  if (!r.success) return { ok: false, error: 'Некорректное тело патча поля' };
  return { ok: true, data: r.data };
}

export function parseFieldReorderBody(body) {
  const r = fieldReorderSchema.safeParse(body);
  if (!r.success) return { ok: false, error: 'Некорректный порядок полей' };
  return { ok: true, data: r.data };
}

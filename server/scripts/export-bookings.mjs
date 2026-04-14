/**
 * Экспорт заказов из БД (DATABASE_URL из .env).
 *
 * Массив (по умолчанию):
 *   npm run export:bookings --prefix server > bookings.json
 *
 * Тело для POST /api/bookings/migrate (удобно с curl -d @file):
 *   node scripts/export-bookings.mjs --migrate-body > migrate-body.json
 *   curl -X POST "https://ВАШ-ДОМЕН/api/bookings/migrate" -H "Content-Type: application/json" -d @migrate-body.json
 *
 * Сработает только пока на проде ещё 0 записей в Booking.
 */
import '../src/env.js';
import { PrismaClient } from '@prisma/client';
const wrap = process.argv.includes('--migrate-body');
const prisma = new PrismaClient();

async function resolveScriptUserId() {
  const fromEnv = process.env.BASE56_SCRIPT_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  const u = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!u) {
    throw new Error(
      'Нет пользователя в БД. Зарегистрируйтесь в приложении или задайте BASE56_SCRIPT_USER_ID в .env',
    );
  }
  return u.id;
}

const userId = await resolveScriptUserId();
const rows = await prisma.booking.findMany({
  where: { userId },
  orderBy: { updatedAt: 'desc' },
});
const list = rows.map((r) => {
  const d = typeof r.data === 'object' && r.data !== null ? r.data : {};
  return {
    ...d,
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
});
console.log(JSON.stringify(wrap ? { bookings: list } : list));
await prisma.$disconnect();

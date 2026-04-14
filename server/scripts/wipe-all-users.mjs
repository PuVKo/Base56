/**
 * Удаляет всех пользователей и связанные данные (каскад: AuthToken, Booking, FieldDefinition).
 * Запуск из каталога server: node scripts/wipe-all-users.mjs
 */
import { prisma } from '../src/db.js';

const r = await prisma.user.deleteMany({});
console.log('Удалено пользователей:', r.count);
await prisma.$disconnect();

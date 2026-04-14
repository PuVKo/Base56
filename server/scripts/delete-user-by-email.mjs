/**
 * Одноразово: удалить пользователя по email (нормализация как в API — lower case).
 * Запуск из server: node scripts/delete-user-by-email.mjs puvko5937@yandex.ru
 */
import '../src/env.js';
import { PrismaClient } from '@prisma/client';

const email = String(process.argv[2] ?? '')
  .trim()
  .toLowerCase();
if (!email) {
  console.error('Usage: node scripts/delete-user-by-email.mjs <email>');
  process.exit(1);
}

const prisma = new PrismaClient();
const r = await prisma.user.deleteMany({ where: { email } });
console.log('deleted users:', r.count);
await prisma.$disconnect();

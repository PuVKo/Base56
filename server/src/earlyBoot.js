/**
 * Подключается первым из index.js: лог в stderr до тяжёлых импортов (Prisma, сессии).
 * На Timeweb без этого при падении на импортах «логов приложения» может не быть.
 */
const ts = () => new Date().toISOString();

console.error(
  `[Base56:early] ${ts()} cwd=${process.cwd()} argv=${JSON.stringify(process.argv.slice(0, 3))} PORT=${process.env.PORT ?? ''} NODE_ENV=${process.env.NODE_ENV ?? ''}`,
);

process.on('uncaughtException', (err) => {
  console.error(`[Base56:early] ${ts()} uncaughtException`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[Base56:early] ${ts()} unhandledRejection`, reason);
  process.exit(1);
});

/**
 * Подключается первым из index.js: синхронный вывод в stderr при падении до тяжёлых импортов.
 */
import fs from 'node:fs';

const ts = () => new Date().toISOString();

function dieSync(label, err) {
  const msg = `[Base56:early] ${ts()} ${label} ${err instanceof Error ? err.stack : String(err)}\n`;
  try {
    fs.writeSync(2, msg);
  } catch {
    console.error(msg.trim());
  }
  process.exit(1);
}

process.on('uncaughtException', (err) => dieSync('uncaughtException', err));

process.on('unhandledRejection', (reason) => dieSync('unhandledRejection', reason));

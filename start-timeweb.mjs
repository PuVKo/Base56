/**
 * Timeweb Apps: если «путь к проекту» = корень репозитория (а не /server), `node src/index.js` не найдёт файл.
 * Задайте команду запуска: `node start-timeweb.mjs` и путь к проекту — корень клона (где лежат package.json и папка server/).
 */
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const line = `[Base56:start-timeweb] cwd_before=${process.cwd()} root=${root}\n`;
try {
  fs.writeSync(2, line);
} catch {
  console.error(line.trim());
}

const serverDir = path.join(root, 'server');
const entry = path.join(serverDir, 'src', 'index.js');

if (!existsSync(entry)) {
  const err = `[Base56:start-timeweb] Нет файла ${entry}. Укажите в панели путь к корню репозитория или команду \`node src/index.js\` при пути /server.\n`;
  try {
    fs.writeSync(2, err);
  } catch {
    console.error(err.trim());
  }
  process.exit(1);
}

process.chdir(serverDir);
await import(pathToFileURL(entry).href);

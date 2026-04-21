/**
 * Timeweb Apps: если «путь к проекту» = корень репозитория (а не /server), `node src/index.js` не найдёт файл.
 * Команда запуска: `node start-timeweb.mjs`, путь к проекту — корень клона (где package.json и папка server/).
 */
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(root, 'server');
const entry = path.join(serverDir, 'src', 'index.js');

if (!existsSync(entry)) {
  const err = `[Base56:start-timeweb] Нет файла ${entry}. Укажите путь к корню репозитория или \`node src/index.js\` при пути /server.\n`;
  try {
    fs.writeSync(2, err);
  } catch {
    console.error(err.trim());
  }
  process.exit(1);
}

process.chdir(serverDir);
await import(pathToFileURL(entry).href);

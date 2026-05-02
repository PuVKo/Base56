import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'server');
// Run concurrently via Node so repo paths with spaces work on Windows (no `.cmd` / `cmd /c`).
const concurrentlyCli = path.join(root, 'node_modules', 'concurrently', 'dist', 'bin', 'concurrently.js');

const migrate = spawnSync('node', ['scripts/prisma-with-schema.mjs', 'migrate', 'deploy'], {
  cwd: server,
  stdio: 'inherit',
  shell: false,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const child = spawn(process.execPath, [concurrentlyCli, '-k', 'npm run dev:vite', 'npm run dev:server'], {
  cwd: root,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

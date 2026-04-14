import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'server');
const concurrentlyBin =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'concurrently.cmd')
    : path.join(root, 'node_modules', '.bin', 'concurrently');

const migrate = spawnSync('node', ['scripts/prisma-with-schema.mjs', 'migrate', 'deploy'], {
  cwd: server,
  stdio: 'inherit',
  shell: false,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const command = process.platform === 'win32' ? 'cmd.exe' : concurrentlyBin;
const commandArgs =
  process.platform === 'win32'
    ? ['/c', concurrentlyBin, '-k', 'npm run dev:vite', 'npm run dev:server']
    : ['-k', 'npm run dev:vite', 'npm run dev:server'];

const child = spawn(command, commandArgs, {
  cwd: root,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

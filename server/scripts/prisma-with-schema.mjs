#!/usr/bin/env node
/**
 * Вызывает prisma с нужным --schema: file:* → sqlite, иначе → postgres.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

const prismaBin =
  process.platform === 'win32'
    ? path.join(serverRoot, 'node_modules', '.bin', 'prisma.cmd')
    : path.join(serverRoot, 'node_modules', '.bin', 'prisma');

function readDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const envPath = path.join(serverRoot, '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    const m = raw.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\n]+)/m);
    if (m) return m[1].trim();
  }
  return '';
}

export function prismaSchemaPath() {
  const url = readDatabaseUrl();
  const sqlite = url.startsWith('file:');
  return path.join(serverRoot, sqlite ? 'prisma/sqlite/schema.prisma' : 'prisma/postgres/schema.prisma');
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: prisma-with-schema.mjs <prisma-args...>');
  process.exit(1);
}

const schema = prismaSchemaPath();
const command = process.platform === 'win32' ? 'cmd.exe' : prismaBin;
const commandArgs =
  process.platform === 'win32' ? ['/c', prismaBin, ...args, '--schema', schema] : [...args, '--schema', schema];

const r = spawnSync(command, commandArgs, {
  cwd: serverRoot,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});
process.exit(r.status ?? 1);

/**
 * Применяет SQL-миграции из prisma/migrations через драйвер `pg`.
 * Нужен, когда `prisma migrate deploy` падает с P1017 / SSL на Timeweb Cloud DB.
 *
 * SSL для `pg`: см. server/src/pgSslConfig.js и PGSSL_REJECT_UNAUTHORIZED в .env.example.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { pgConnectionOptions } from '../src/pgSslConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const migrationsDir = path.join(serverRoot, 'prisma', 'postgres', 'migrations');
dotenv.config({ path: path.join(serverRoot, '.env') });

function loadDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const envPath = path.join(serverRoot, '.env');
  if (!fs.existsSync(envPath)) {
    console.error(
      'Нет DATABASE_URL: задайте переменную окружения (Docker/Timeweb build) или server/.env для локальной разработки.'
    );
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  const m = raw.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/m);
  if (!m) {
    console.error('В .env не найден DATABASE_URL');
    process.exit(1);
  }
  return m[1].trim();
}

function listMigrationDirs() {
  const names = fs.readdirSync(migrationsDir).filter((n) => {
    const p = path.join(migrationsDir, n);
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'migration.sql'));
  });
  return names.sort();
}

async function ensureMigrationsTable(client) {
  await client.query(`
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
`);
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  const client = new pg.Client(pgConnectionOptions(databaseUrl));
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const resolveChecksumMismatch =
      (process.env.PG_MIGRATE_RESOLVE_CHECKSUM_MISMATCH ?? '').trim() === '1';

    for (const dirName of listMigrationDirs()) {
      const sqlPath = path.join(migrationsDir, dirName, 'migration.sql');
      const body = fs.readFileSync(sqlPath);
      const checksum = crypto.createHash('sha256').update(body).digest('hex');

      const existing = await client.query(
        `SELECT "checksum" FROM "_prisma_migrations" WHERE "migration_name" = $1`,
        [dirName]
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].checksum !== checksum) {
          if (resolveChecksumMismatch) {
            const previous = existing.rows[0].checksum;
            await client.query(
              `UPDATE "_prisma_migrations" SET "checksum" = $1 WHERE "migration_name" = $2`,
              [checksum, dirName]
            );
            console.warn(
              `Checksum mismatch for ${dirName} — updated checksum in _prisma_migrations (${previous} -> ${checksum})`
            );
          } else {
            console.error(`Checksum mismatch for ${dirName}`);
            console.error(
              'Set PG_MIGRATE_RESOLVE_CHECKSUM_MISMATCH=1 to update checksum in _prisma_migrations and continue.'
            );
            process.exit(1);
          }
        }
        console.log(`skip (already applied): ${dirName}`);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(body.toString('utf8'));
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
           VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
          [id, checksum, dirName]
        );
        await client.query('COMMIT');
        console.log(`applied: ${dirName}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

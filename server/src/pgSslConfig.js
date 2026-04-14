import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const timewebCaPath = path.join(serverRoot, 'certs', 'timeweb-ca.crt');

/**
 * Убираем ssl* из URL. Для node-pg v8 sslmode=require в строке трактуется как verify-full и
 * ломает ручной ssl: { rejectUnauthorized: false } — режим TLS задаём только через options.ssl.
 * @param {string} connectionString
 * @param {boolean} dropSslMode
 */
export function sanitizeConnectionStringForPg(connectionString, dropSslMode) {
  try {
    const u = new URL(connectionString);
    u.searchParams.delete('sslrootcert');
    u.searchParams.delete('sslcert');
    u.searchParams.delete('sslkey');
    if (dropSslMode) {
      u.searchParams.delete('sslmode');
    }
    return u.href;
  } catch {
    return connectionString;
  }
}

/**
 * Опции для `pg.Pool` / `pg.Client` при managed Postgres с цепочкой, которую Node не доверяет
 * (Timeweb *.twc1.net и т.п.). См. PGSSL_REJECT_UNAUTHORIZED в .env.example.
 * @param {string} connectionString
 */
export function pgConnectionOptions(connectionString) {
  const needsSsl =
    /sslmode=(require|verify-ca|verify-full)/i.test(connectionString) ||
    connectionString.includes('twc1.net');
  if (!needsSsl) {
    return { connectionString };
  }

  const timewebHost = connectionString.includes('twc1.net');
  const relaxSsl = timewebHost || process.env.PGSSL_REJECT_UNAUTHORIZED === '0';
  const connectionStringClean = sanitizeConnectionStringForPg(connectionString, relaxSsl);
  const base = { connectionString: connectionStringClean };

  if (relaxSsl) {
    return {
      ...base,
      ssl: { rejectUnauthorized: false },
    };
  }
  if (fs.existsSync(timewebCaPath)) {
    return {
      ...base,
      ssl: {
        ca: fs.readFileSync(timewebCaPath).toString(),
        rejectUnauthorized: true,
      },
    };
  }
  return base;
}

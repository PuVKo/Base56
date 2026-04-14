#!/bin/sh
# Сборка на Timeweb/Docker: prisma generate требует синтаксически валидный DATABASE_URL,
# даже если к БД на этом шаге не подключаются. Реальный URL нужен только для миграций.
set -e
cd "$(dirname "$0")/.."

REAL_URL="$DATABASE_URL"
export DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?sslmode=disable"

npx prisma generate --schema=prisma/postgres/schema.prisma

SERVER_ROOT="$(pwd)"
REPO_ROOT="$(cd .. && pwd)"
if [ -f "$REPO_ROOT/vite.config.js" ] && [ -f "$REPO_ROOT/package.json" ]; then
  echo "base56: vite build (корень репозитория)..."
  (cd "$REPO_ROOT" && npm install --no-audit --no-fund && npm run build)
  cd "$SERVER_ROOT"
fi

export DATABASE_URL="$REAL_URL"
if [ -z "$DATABASE_URL" ]; then
  echo "build-server.sh: нет DATABASE_URL — задайте в переменных сборки (Timeweb App)." >&2
  exit 1
fi
case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *)
    echo "build-server.sh: DATABASE_URL должен начинаться с postgresql:// или postgres://" >&2
    exit 1
    ;;
esac

# Node/pg в Docker не доверяет цепочке Timeweb → SELF_SIGNED_CERT_IN_CHAIN.
# Только для этого шага сборки (не для локального npm run db:migrate:apply-pg без этого скрипта).
export PGSSL_REJECT_UNAUTHORIZED=0
node scripts/pg-migrate-apply.mjs

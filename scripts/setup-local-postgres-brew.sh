#!/bin/sh
# Одноразовая настройка локального Postgres через Homebrew (без Docker).
# Запуск из корня репозитория: npm run db:local:brew
set -e
if ! command -v brew >/dev/null 2>&1; then
  echo "Нужен Homebrew: https://brew.sh" >&2
  exit 1
fi
brew list postgresql@16 >/dev/null 2>&1 || brew install postgresql@16
brew services start postgresql@16
PG_BIN="$(brew --prefix postgresql@16)/bin"
export PATH="$PG_BIN:$PATH"
# Даём сервису время подняться
sleep 2
if ! "$PG_BIN/psql" postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='base56'" | grep -q 1; then
  "$PG_BIN/createuser" -s base56
fi
"$PG_BIN/psql" postgres -c "ALTER USER base56 WITH PASSWORD 'base56';"
"$PG_BIN/createdb" -O base56 base56 2>/dev/null || true
echo "Готово. DATABASE_URL=postgresql://base56:base56@localhost:5432/base56"
echo "Дальше: npm run db:local:migrate && npm run dev:only"

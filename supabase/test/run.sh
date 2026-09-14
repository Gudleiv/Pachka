#!/usr/bin/env bash
# Прогон RLS-политик на локальном Postgres. Нужен запущенный сервер и psql.
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres ./supabase/test/run.sh
set -euo pipefail

DB="${PACHKA_TEST_DB:-pachka_rls_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

dropdb --if-exists "$DB"
createdb "$DB"
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/00_supabase_stub.sql"
psql -d "$DB" -q -f "$HERE/../schema.sql" 2>&1 | grep -v NOTICE || true

out="$(psql -d "$DB" -f "$HERE/01_rls_test.sql" 2>&1)"
echo "$out" | grep -E 'OK:|ПРОВАЛ:|^ [a-z_]+:|^--- [0-9]' || true

if echo "$out" | grep -q 'ПРОВАЛ:'; then
  echo "RLS: есть провалы" >&2
  exit 1
fi
# Непойманная ошибка SQL тоже означает, что проверка не отработала.
if echo "$out" | grep -q '^psql:.*ERROR:'; then
  echo "$out" | grep '^psql:.*ERROR:' >&2
  echo "RLS: тест упал с ошибкой SQL" >&2
  exit 1
fi
echo "RLS: все проверки прошли"

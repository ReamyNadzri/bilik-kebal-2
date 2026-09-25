#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres 16 with stubbed
# `auth` and `storage` schemas, then runs the scripted assertions. Each test
# runs in a transaction that is rolled back. Never point this at Supabase Cloud.
#
#   PGHOST=/tmp/pgtest PGPORT=55999 PGUSER=postgres supabase/tests/local/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
db="${PGDATABASE_TEST:-vaultix_migration_check}"

psql -qc "drop database if exists $db" -c "create database $db" >/dev/null
psql -d "$db" -q -v ON_ERROR_STOP=1 -f "$here/00_stub_auth_storage.sql"
for migration in "$root"/supabase/migrations/*.sql; do
  psql -d "$db" -q -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done
echo "migrations applied"
for test in "$here"/*.sql; do
  [ "$(basename "$test")" = "00_stub_auth_storage.sql" ] && continue
  psql -d "$db" -q -v ON_ERROR_STOP=1 -f "$test" 2>&1 | grep -E "NOTICE|ERROR" || true
done

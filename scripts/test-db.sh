#!/usr/bin/env sh
# Applies the Supabase migration to a scratch Postgres database (twice, to
# prove it is idempotent) and runs the row-level security tests.
# Usage: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres scripts/test-db.sh
set -eu
: "${DATABASE_URL:?set DATABASE_URL to a disposable Postgres database}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="psql $DATABASE_URL -q -v ON_ERROR_STOP=1"
$PSQL -c "drop schema if exists public cascade; drop schema if exists storage cascade; drop schema if exists auth cascade; create schema public;"
$PSQL -f "$DIR/supabase/tests/00_auth_stub.sql"
for f in "$DIR"/supabase/migrations/*.sql; do $PSQL -f "$f" >/dev/null; done
for f in "$DIR"/supabase/migrations/*.sql; do $PSQL -f "$f" >/dev/null; done
$PSQL -f "$DIR/supabase/tests/10_rls_test.sql"
$PSQL -f "$DIR/supabase/tests/20_storage_test.sql"

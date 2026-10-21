#!/usr/bin/env bash
# Tests supabase/admin.sql against a throwaway local Postgres: it loads Mod Squad's real SQL files,
# applies admin.sql (twice, to prove it is re-runnable), then tries to break in as a normal user.
#
#   MOD_SQUAD_DIR=/path/to/mod-squad PGHOST=/socket/dir PGPORT=5432 test/db/run.sh
#
# Needs a Postgres 15+ you can create databases in. The libpq variables (PGHOST, PGPORT, PGUSER)
# say where; the database it uses, admin_test, is dropped and recreated every run.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
mod_squad="${MOD_SQUAD_DIR:-$root/../mod-squad}/supabase"
[ -d "$mod_squad" ] || { echo "Set MOD_SQUAD_DIR to a checkout of the Mod Squad repo (no $mod_squad)"; exit 2; }

export PGDATABASE=admin_test
psql -d postgres -qAt -c "drop database if exists $PGDATABASE with (force)" -c "create database $PGDATABASE" >/dev/null

run() { psql -v ON_ERROR_STOP=1 -q -X "$@"; }
quiet() { PGOPTIONS="-c client_min_messages=warning" run "$@"; }

echo "-- stubs";               quiet -f "$here/supabase-stub.sql" >/dev/null
echo "-- Mod Squad's SQL";     for f in profiles assignment4 assignment4_photos assignment4_render assignment4_edit; do quiet -f "$mod_squad/$f.sql" >/dev/null; done
echo "-- admin.sql (1st run)"; quiet -f "$root/supabase/admin.sql" >/dev/null
echo "-- admin.sql (2nd run)"; quiet -f "$root/supabase/admin.sql" >/dev/null
echo "-- tests";               out="$(run -v mod_squad_profiles_sql="$mod_squad/profiles.sql" -f "$here/admin.test.sql" 2>&1)" && status=0 || status=$?
echo "$out" | grep -E "PASS|FAIL|ERROR" || true
if [ "$status" -eq 0 ]; then echo "ALL DATABASE TESTS PASSED ($(echo "$out" | grep -c PASS) checks)"; else echo "DATABASE TESTS FAILED"; exit 1; fi

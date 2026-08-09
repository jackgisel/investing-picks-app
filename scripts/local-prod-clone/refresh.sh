#!/bin/sh
set -eu

# Rebuild two narrowly named local databases from production:
#   - portfolio/market data (complete)
#   - web schema plus allowlisted published content only
#
# Production is read-only throughout. Local databases are dropped and recreated
# on every run, which makes a partially completed refresh safe to rerun.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

LOCAL_PG_ADMIN_URL=${LOCAL_PG_ADMIN_URL:-postgresql:///postgres}
LOCAL_MAIN_DB=${LOCAL_MAIN_DB:-outpick_dev}
LOCAL_WEB_DB=${LOCAL_WEB_DB:-outpick_web_dev}
LOCAL_TEST_EMAIL=${LOCAL_TEST_EMAIL:-local@outpick.test}
LOCAL_TEST_PASSWORD=${LOCAL_TEST_PASSWORD:-outpick-local}
RAILWAY_ENVIRONMENT=${RAILWAY_ENVIRONMENT:-production}
RAILWAY_POSTGRES_SERVICE=${RAILWAY_POSTGRES_SERVICE:-Postgres}
PROD_WEB_DB=${PROD_WEB_DB:-outpick_web}

say() {
  printf '\n==> %s\n' "$1"
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

validate_database_name() {
  case "$1" in
    ''|*[!A-Za-z0-9_]*|[0-9]*)
      die "unsafe database name: $1"
      ;;
    postgres|template0|template1)
      die "refusing to replace protected database: $1"
      ;;
  esac
}

database_url() {
  url=$1
  database=$2
  base=${url%%\?*}
  query=
  if [ "$base" != "$url" ]; then
    query="?${url#*\?}"
  fi
  printf '%s/%s%s' "${base%/*}" "$database" "$query"
}

find_pg18_bin() {
  if [ -n "${PG18_BIN:-}" ]; then
    printf '%s' "$PG18_BIN"
    return
  fi

  for candidate in \
    /opt/homebrew/opt/postgresql@18/bin \
    /usr/local/opt/postgresql@18/bin
  do
    if [ -x "$candidate/pg_dump" ] && [ -x "$candidate/pg_restore" ]; then
      printf '%s' "$candidate"
      return
    fi
  done

  if command -v pg_dump >/dev/null 2>&1; then
    major=$(pg_dump --version | sed -E 's/.* ([0-9]+).*/\1/')
    if [ "$major" -ge 18 ] 2>/dev/null; then
      dirname "$(command -v pg_dump)"
      return
    fi
  fi

  die "PostgreSQL 18 client tools are required. Install them with: brew install postgresql@18"
}

recreate_database() {
  database=$1
  psql "$LOCAL_PG_ADMIN_URL" --set=ON_ERROR_STOP=1 --set=database="$database" >/dev/null <<'SQL'
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
 WHERE datname = :'database'
   AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS :"database" WITH (FORCE);
CREATE DATABASE :"database";
SQL
}

restore_archive() {
  archive=$1
  target_url=$2
  clean=${3:-false}

  clean_args=
  if [ "$clean" = true ]; then
    clean_args='--clean --if-exists'
  fi

  # PostgreSQL 18 emits transaction_timeout, which older local servers do not
  # recognize. The application schema itself is compatible; remove only that
  # session-level SET while preserving fail-fast behavior for every real error.
  # shellcheck disable=SC2086 -- clean_args is a fixed internal option list.
  "$PG18_BIN/pg_restore" \
    $clean_args \
    --no-owner \
    --no-acl \
    --file=- \
    "$archive" \
    | sed '/^SET transaction_timeout =/d' \
    | psql "$target_url" --set=ON_ERROR_STOP=1 --quiet --output=/dev/null
}

validate_database_name "$LOCAL_MAIN_DB"
validate_database_name "$LOCAL_WEB_DB"
[ "$LOCAL_MAIN_DB" != "$LOCAL_WEB_DB" ] || die "local database names must be different"

need railway
need jq
need psql
need node
PG18_BIN=$(find_pg18_bin)

cd "$REPO_ROOT"

say "Resolving the production database through Railway"
PROD_MAIN_URL=$(
  railway variable \
    --service "$RAILWAY_POSTGRES_SERVICE" \
    --environment "$RAILWAY_ENVIRONMENT" \
    --json \
    | jq -er '.DATABASE_PUBLIC_URL'
)
PROD_WEB_URL=$(database_url "$PROD_MAIN_URL" "$PROD_WEB_DB")
LOCAL_MAIN_URL=$(database_url "$LOCAL_PG_ADMIN_URL" "$LOCAL_MAIN_DB")
LOCAL_WEB_URL=$(database_url "$LOCAL_PG_ADMIN_URL" "$LOCAL_WEB_DB")

PROD_MAJOR=$(psql "$PROD_MAIN_URL" --tuples-only --no-align --command='SHOW server_version_num' | cut -c1-2)
[ "$PROD_MAJOR" -eq 18 ] || die "expected production PostgreSQL 18, found major version $PROD_MAJOR"

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/outpick-local-clone.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM
MAIN_ARCHIVE="$TMP_DIR/main.dump"
WEB_SCHEMA_ARCHIVE="$TMP_DIR/web-schema.dump"
WEB_CONTENT_ARCHIVE="$TMP_DIR/web-content.dump"

say "Exporting production portfolio and market data (read-only)"
"$PG18_BIN/pg_dump" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$MAIN_ARCHIVE" \
  "$PROD_MAIN_URL"

say "Exporting the web schema"
"$PG18_BIN/pg_dump" \
  --format=custom \
  --schema-only \
  --no-owner \
  --no-acl \
  --file="$WEB_SCHEMA_ARCHIVE" \
  "$PROD_WEB_URL"

say "Exporting only allowlisted published web content"
"$PG18_BIN/pg_dump" \
  --format=custom \
  --data-only \
  --strict-names \
  --table=public.insight \
  --no-owner \
  --no-acl \
  --file="$WEB_CONTENT_ARCHIVE" \
  "$PROD_WEB_URL"

if "$PG18_BIN/pg_restore" --list "$WEB_CONTENT_ARCHIVE" \
  | grep 'TABLE DATA' \
  | grep -Ev 'TABLE DATA public insight( |$)' \
  >/dev/null 2>&1
then
  die "sanitization check failed: the web data archive contains a non-allowlisted table"
fi

say "Recreating local databases $LOCAL_MAIN_DB and $LOCAL_WEB_DB"
recreate_database "$LOCAL_MAIN_DB"
recreate_database "$LOCAL_WEB_DB"

say "Restoring sanitized data locally"
restore_archive "$MAIN_ARCHIVE" "$LOCAL_MAIN_URL" true
restore_archive "$WEB_SCHEMA_ARCHIVE" "$LOCAL_WEB_URL" true
restore_archive "$WEB_CONTENT_ARCHIVE" "$LOCAL_WEB_URL"

say "Creating the local subscriber/admin account"
LOCAL_WEB_DATABASE_URL=$LOCAL_WEB_URL \
LOCAL_TEST_EMAIL=$LOCAL_TEST_EMAIL \
LOCAL_TEST_PASSWORD=$LOCAL_TEST_PASSWORD \
  node "$SCRIPT_DIR/seed-local-user.mjs"

say "Writing local service configuration"
mkdir -p "$REPO_ROOT/apps/api" "$REPO_ROOT/apps/web"
printf '%s\n' \
  '# Generated by scripts/local-prod-clone/refresh.sh' \
  "DATABASE_URL=postgresql+psycopg:///$LOCAL_MAIN_DB" \
  'APP_ENV=development' \
  'OPS_API_KEY=dev-ops-key' \
  'CORS_ORIGINS=http://localhost:3000' \
  > "$REPO_ROOT/apps/api/.env"

printf '%s\n' \
  '# Generated by scripts/local-prod-clone/refresh.sh' \
  "DATABASE_URL=$LOCAL_WEB_URL" \
  'OUTPICK_API_URL=http://localhost:8000' \
  'OPS_API_KEY=dev-ops-key' \
  'BETTER_AUTH_SECRET=outpick-local-development-secret-change-before-production' \
  'BETTER_AUTH_URL=http://localhost:3000' \
  'NEXT_PUBLIC_APP_URL=http://localhost:3000' \
  'REQUIRE_EMAIL_VERIFICATION=false' \
  "ADMIN_EMAILS=$LOCAL_TEST_EMAIL" \
  > "$REPO_ROOT/apps/web/.env.local"

say "Verifying the local clone"
MAIN_COUNTS=$(psql "$LOCAL_MAIN_URL" --tuples-only --no-align --command='SELECT (SELECT COUNT(*) FROM stocks) || chr(124) || (SELECT COUNT(*) FROM price_bars) || chr(124) || (SELECT COUNT(*) FROM positions) || chr(124) || (SELECT COUNT(*) FROM evaluations)')
WEB_COUNTS=$(psql "$LOCAL_WEB_URL" --tuples-only --no-align --command='SELECT (SELECT COUNT(*) FROM insight) || chr(124) || (SELECT COUNT(*) FROM "user") || chr(124) || (SELECT COUNT(*) FROM session) || chr(124) || (SELECT COUNT(*) FROM market_note_subscriber) || chr(124) || (SELECT COUNT(*) FROM post_comment)')

printf '\nLocal clone ready.\n'
printf '  Main rows (stocks|price bars|positions|evaluations): %s\n' "$MAIN_COUNTS"
printf '  Web rows  (insights|users|sessions|subscribers|comments): %s\n' "$WEB_COUNTS"
printf '  Login:    %s\n' "$LOCAL_TEST_EMAIL"
printf '  Password: %s\n' "$LOCAL_TEST_PASSWORD"
printf '\nRestart the API and web dev servers so they load the generated env files.\n'

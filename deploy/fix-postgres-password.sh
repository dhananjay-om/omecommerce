#!/usr/bin/env bash
# One-time fix for: "Authentication failed against database server at
# postgres, the provided database credentials for <user> are not valid."
#
# Why this happens: Postgres only applies POSTGRES_USER/POSTGRES_PASSWORD
# from the environment the very FIRST time its data volume initializes. If
# the postgres container was ever started earlier with a different
# password (e.g. before .env.production was finalized), later changing
# POSTGRES_PASSWORD does nothing — the old password stays baked into the
# already-initialized volume, and every app container trying to connect
# with the new value gets rejected.
#
# The fix: connect to postgres via `docker exec` (the LOCAL unix socket
# inside the container, which Postgres trusts by default regardless of the
# stored password — no need to know the old one) and reset the password to
# match .env.production. No data is touched or lost.
#
# Verified end-to-end against a real throwaway Postgres container before
# this script was written: local trust-auth connection succeeds without
# the password, the old password correctly stops working afterward, and
# the new one works immediately over TCP (the same way the api container
# connects).
#
# Run from the repo root: ./deploy/fix-postgres-password.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env.production ]; then
  echo "!! .env.production not found." >&2
  exit 1
fi
set -a; source .env.production; set +a
: "${POSTGRES_USER:?POSTGRES_USER must be set in .env.production}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env.production}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in .env.production}"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Resetting Postgres password for '$POSTGRES_USER' to match .env.production"
$COMPOSE exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '$POSTGRES_PASSWORD';"

echo "==> Restarting api so it reconnects with the corrected password"
$COMPOSE restart api

echo "==> Waiting for api to report healthy"
for i in $(seq 1 30); do
  $COMPOSE ps api 2>/dev/null | grep -q "(healthy)" && break
  sleep 1
done

echo "==> Tailing recent api logs — should show NO more 'Authentication failed' errors"
$COMPOSE logs api --tail 30

echo
echo "Done. If the log above is clean, retest https://omecom.vcto.in/"

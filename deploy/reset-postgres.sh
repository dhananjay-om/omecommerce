#!/usr/bin/env bash
# Fixes: "role <user> does not exist" / password-mismatch errors against
# Postgres, caused by the data volume having been initialized at some
# earlier point with different credentials than what's currently in
# .env.production. Postgres only ever applies POSTGRES_USER/
# POSTGRES_PASSWORD/POSTGRES_DB from the environment on the FIRST boot of an
# empty data directory — once initialized, it ignores those env vars
# entirely, even across container recreates, until the volume itself is
# reset. This DELETES the Postgres data volume (only that volume — Redis,
# MinIO media, OpenSearch, and the TLS certs are untouched) and lets it
# reinitialize fresh with your current .env.production values, then
# re-runs migrate + seed.
#
# Only run this if you're sure there's nothing worth keeping in the current
# Postgres data (see the conversation this came from for that judgment call
# — this script does not ask for confirmation, it just does it).
#
# Run from the repo root: ./deploy/reset-postgres.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env.production ]; then
  echo "!! .env.production not found." >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Stopping and removing the postgres container"
$COMPOSE rm -sf postgres

echo "==> Finding its data volume"
VOL=$(docker volume ls -q --filter label=com.docker.compose.volume=pgdata)
if [ -z "$VOL" ]; then
  echo "!! Could not find the pgdata volume automatically. All volumes on this host:" >&2
  docker volume ls
  exit 1
fi
echo "    found: $VOL"

echo "==> Deleting it"
docker volume rm "$VOL"

echo "==> Starting postgres fresh — it will now actually apply .env.production's credentials"
$COMPOSE up -d postgres

echo "==> Waiting for postgres to report healthy"
for i in $(seq 1 30); do
  $COMPOSE ps postgres 2>/dev/null | grep -q "(healthy)" && break
  sleep 1
done
$COMPOSE ps postgres

echo
echo "==> Running migrations against the fresh database"
$COMPOSE exec api npm run migrate:deploy

echo
echo "==> Seeding"
$COMPOSE exec api npm run db:seed

echo
echo "==> Restarting api (clears any cached failed-connection state)"
$COMPOSE restart api

echo
echo "==> Recent api logs — should show NO Authentication/PrismaClientInitializationError lines"
$COMPOSE logs api --tail 30

echo
echo "Done. Retest https://omecom.vcto.in/ and https://omecom.vcto.in/admin/login"

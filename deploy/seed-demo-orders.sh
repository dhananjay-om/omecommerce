#!/usr/bin/env bash
# Runs scripts/seed-demo-orders.mjs against production, inside the `api`
# container — where @prisma/client and every other dependency actually
# live. This repo's checkout on the bare host has no node_modules of its
# own (that's why `node scripts/seed-demo-orders.mjs` run directly on the
# host fails with ERR_MODULE_NOT_FOUND: '@prisma/client') — only the built
# Docker images do (see the Dockerfile's runtime stage, which already
# COPYs scripts/ in). Rebuilds `api` first so the image picks up the
# script file itself, in case the currently-running image predates it.
#
# Run from the repo root, after `git pull`: ./deploy/seed-demo-orders.sh
#
# To change how many orders / how far back / which admin login it uses,
# edit the defaults right below rather than typing them inline — same
# reasoning as every other script in this repo.
set -uo pipefail

ORDER_COUNT="${ORDER_COUNT:-60}"
DAYS_BACK="${DAYS_BACK:-90}"
STORE_VIEW_ID="${STORE_VIEW_ID:-1}"
# The dev-seed admin login (scripts/seed-demo-data.mjs's own default) — if
# your production admin was set up with a different email/password, edit
# these two lines rather than the deploy invocation.
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@ome.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-dev-only-password-change-me}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (picks up scripts/seed-demo-orders.mjs if the running image predates it)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Running scripts/seed-demo-orders.mjs inside the api container ($ORDER_COUNT orders, $DAYS_BACK days back)"
# API_BASE_URL=http://localhost:3000 — inside this container the api
# process itself listens on port 3000 (docker-compose.prod.yml's own
# `PORT: 3000`), not the 4100 the script defaults to for local dev.
# DATABASE_URL is already set correctly as a container env var (points at
# the `postgres` service on the internal Docker network, not localhost) —
# no override needed for that one.
$COMPOSE exec \
  -e API_BASE_URL=http://localhost:3000 \
  -e ORDER_COUNT="$ORDER_COUNT" \
  -e DAYS_BACK="$DAYS_BACK" \
  -e STORE_VIEW_ID="$STORE_VIEW_ID" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  api node scripts/seed-demo-orders.mjs
if [ $? -ne 0 ]; then
  echo "!! seeding failed — see the output above. If it's a login error, your" >&2
  echo "   production admin isn't admin@ome.local/dev-only-password-change-me" >&2
  echo "   — edit ADMIN_EMAIL/ADMIN_PASSWORD near the top of this script and" >&2
  echo "   re-run." >&2
  exit 1
fi

echo
echo "==> Done. Reload /admin/dashboard (or any /admin/reports/* page) to see the spread."

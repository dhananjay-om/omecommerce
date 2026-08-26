#!/usr/bin/env bash
# Runs scripts/seed-demo-reviews.mjs against production, inside the `api`
# container — same "host checkout has no node_modules of its own" reasoning
# as deploy/seed-demo-orders.sh. Writes directly via Prisma (no HTTP calls,
# no admin login needed) — there's no admin endpoint to create a review
# through (see ProductReview's own schema doc comment: no submission/
# moderation flow in this system by design).
#
# Idempotent: skips any of its target products that already has a review.
#
# Run from the repo root, after `git pull`: ./deploy/seed-demo-reviews.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (picks up scripts/seed-demo-reviews.mjs if the running image predates it)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Running scripts/seed-demo-reviews.mjs inside the api container"
# DATABASE_URL is already set correctly as a container env var — this
# script only needs Prisma, no API_BASE_URL/admin login involved.
$COMPOSE exec api node scripts/seed-demo-reviews.mjs
if [ $? -ne 0 ]; then
  echo "!! seeding failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Reload a seeded product's Reviews tab (e.g. DEMO-COFFEE-MAKER) to see it."

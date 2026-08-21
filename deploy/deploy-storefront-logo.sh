#!/usr/bin/env bash
# Deploys the storefront logo fix — the admin's Stores > General Settings >
# Store Logo upload now actually shows up on the storefront (header + footer),
# via a new public GET /store/v1/website endpoint. Touches the backend API
# (new route) and the storefront (header/footer now read it). No migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-storefront-logo.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding backend API (new /store/v1/website route)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! backend build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. If you haven't already, upload a logo in the admin"
echo "    under Stores > General Settings, then reload the storefront."

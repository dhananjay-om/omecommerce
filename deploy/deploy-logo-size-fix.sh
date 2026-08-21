#!/usr/bin/env bash
# Deploys a larger storefront logo (header/footer). Storefront-only, no
# backend or migration changes.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-logo-size-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding storefront"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."

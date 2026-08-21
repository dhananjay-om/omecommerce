#!/usr/bin/env bash
# Deploys admin error boundaries + the product detail/edit page fix (a
# product page that crashed the whole browser connection on any fetch
# error now shows a clean, recoverable error card, and 404s cleanly for a
# genuinely missing product). Admin-only, no migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-admin-error-boundaries.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo "    If that specific product page still errors, it'll now show a card"
echo "    with a digest number instead of crashing — if it does, run"
echo "    ./deploy/diagnose-product-detail.sh and share the output so the"
echo "    underlying cause can be tracked down."

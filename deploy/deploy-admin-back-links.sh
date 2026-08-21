#!/usr/bin/env bash
# Deploys "Back" links added across every admin edit/new page that was
# missing one (product edit, categories, coupons, banners, CMS blocks/
# pages, widgets, gift cards, companies). Admin-only, no migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-admin-back-links.sh
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

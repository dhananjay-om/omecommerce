#!/usr/bin/env bash
# The image chosen as a product's "main image" in the admin now shows everywhere.
#
# Two mismatches fixed:
#   1. Home page / listing / search cards took their image from the search index,
#      which only changes when a background job re-indexes the product. If that job
#      was late or failed for a product, the card kept showing the old picture no
#      matter what was picked in the admin. Cards now read the current main image
#      straight from the database every time (falls back to the index only if that
#      lookup itself errors), so they can't go stale.
#   2. The product page's gallery opened on the first image by position, not the
#      chosen main image. The main image now leads the gallery (the others keep
#      their order). The wishlist uses the same list, so it follows too.
#
# API only. No migration, no new permission. No reindex needed.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-main-image-consistency.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Hard-reload the home page and a product page (Ctrl+Shift+R) —"
echo "both should show the image marked as main in the admin."

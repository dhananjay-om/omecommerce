#!/usr/bin/env bash
# Product cards (home sliders, listing/search/collection pages, related
# products) used to show the same 4 fixed colour dots on EVERY product. They
# now show the product's REAL colours — each colour option on its variants
# that has a hex swatch set (Catalog > Attributes > option swatch) — and a
# product with no colour-swatched variants shows no dots at all. The dots sit
# on the brand line (right side), so they never change a card's height and
# prices stay aligned.
#
# Needs a search reindex: swatches are stored in each product's search
# document, so existing products only get them once reindexed (new/edited
# products index themselves automatically). This script does the reindex for
# you — it will ask for an admin login.
#
# No migration, no permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-real-color-swatches.sh
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

echo "==> Rebuilding storefront"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Reindexing search so existing products get their colour swatches"
"$REPO_ROOT/deploy/reindex-search.sh"

echo
echo "==> Deploy complete. Hard-reload the site (Ctrl+Shift+R). Products whose"
echo "colour options have a hex swatch show real dots; the rest show none."
echo "If a colour you expect is missing, check that option has a swatch set"
echo "under Catalog > Attributes."

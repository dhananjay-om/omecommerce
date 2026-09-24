#!/usr/bin/env bash
# ONE script for all of the recent storefront UI fixes — run this instead of
# the individual ones (deploy-header-logo-size-fix.sh,
# deploy-shop-by-category-wrap-fix.sh, deploy-mega-menu-close-and-scroll-fix.sh,
# deploy-product-card-alignment-fix.sh, deploy-real-color-swatches.sh).
# Each of those only rebuilds from the latest code anyway, so after `git pull`
# one rebuild ships every fix at once.
#
#   - Header logo renders at its natural size (max 48px) instead of a fixed 40px
#   - "Shop by Category" wraps onto rows instead of scrolling sideways
#   - Mega menu closes after clicking a link (mobile menu drawer too), and the
#     invisible dropdown no longer pushes the page wider than the window
#     (that was the sideways scrollbar / cut-off edges on the home page)
#   - Product cards: price / discount / stars line up across every card
#   - Product cards: real colour swatches (from each product's colour options
#     that have a hex swatch) instead of 4 fixed dots; none shown if a product
#     has none
#
# The colour swatches need the api rebuilt and a search reindex (they're stored
# in each product's search document) — this script does both. It will ask for
# an admin email/password for the reindex step.
#
# No migration, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-storefront-ui-fixes.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (colour swatches in search results)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (all the UI fixes)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Reindexing search so existing products get their colour swatches"
"$REPO_ROOT/deploy/reindex-search.sh"

echo
echo "==> Done. Hard-reload the site (Ctrl+Shift+R) and check: logo size,"
echo "Shop by Category, mega menu closing on click, no sideways scroll,"
echo "aligned product cards, and colour dots only on products that have colours."

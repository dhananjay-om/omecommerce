#!/usr/bin/env bash
# Follow-up to deploy-plp-theme-and-color-facets.sh — closes the remaining
# visual gaps on the category page (/collections/[slug]) reported after
# that deploy: the sidebar was missing a "Category" list (All {parent} +
# siblings, active one highlighted) and the price filter was still a plain
# Min/Max number-input pair instead of the theme's own slider.
#
#   - New sidebar "Category" section, built from real listCategories() data
#     (not a mock) — shown first, above Brand, matching theme/'s
#     ProductListing.tsx Filters exactly.
#   - Price filter is now a real single "Max Price" slider (currency-aware
#     bounds: INR up to 25,000 matching the theme's own hardcoded bound,
#     USD up to 2,000 for this catalog) instead of two number inputs.
#
# Storefront only — no backend/admin changes, no migration, no new
# permission, no OpenSearch reindex needed (unlike the previous deploy).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-category-page-sidebar-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding storefront"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission, no reindex needed."
echo "Open any /collections/<slug> page with sibling categories (e.g. a"
echo "Women/Men-style pair) to see the new sidebar Category list, and drag"
echo "the Max Price slider to confirm it filters and updates the URL."

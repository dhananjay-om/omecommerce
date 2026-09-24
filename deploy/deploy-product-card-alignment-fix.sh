#!/usr/bin/env bash
# Fixes product cards in the Bestsellers / product sliders (and the product
# grids, which share the same card) looking misaligned: a product with a long
# name wrapped to two lines and a short one stayed on one, so price, discount
# price, stars and swatches sat at different heights from card to card.
#
#   - The title now always reserves two lines, so everything under it starts
#     at the same height on every card.
#   - Slider slides now stretch to equal height, so price/swatches pin to the
#     same bottom edge.
#   - On narrow phone cards where price + struck-through price + stars wrap,
#     two lines are reserved for that row too.
#
# Storefront only — no migration, no permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-product-card-alignment-fix.sh
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
echo "==> Deploy complete. Hard-reload the home page (Ctrl+Shift+R): product"
echo "prices and swatches should line up across every card."

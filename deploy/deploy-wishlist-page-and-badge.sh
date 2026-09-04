#!/usr/bin/env bash
# Follow-up to deploy-wishlist-fix.sh — 2 improvements the user asked for
# after trying that fix:
#
#   - Account > Wishlist now shows each item's real image, price (with a
#     struck-through MRP + "Out of stock" when applicable), and a working
#     "Add to Cart" button — not just its name and SKU. One real
#     GET /store/v1/products/:id per item (server-side, in parallel), same
#     route the product-card's own Quick Add already calls.
#   - The header wishlist heart now shows a real count badge (matching the
#     cart icon's own badge treatment exactly) that updates instantly from
#     the shared wishlist store — no reload needed.
#
# (The third ask — hearts staying filled after a reload — was already
# fixed in deploy-wishlist-fix.sh; re-verified working here too, including
# with multiple wishlisted products at once.)
#
# Storefront only — no backend/admin changes, no migration, no new
# permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-wishlist-page-and-badge.sh
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
echo "==> Deploy complete. No migration, no new permission."
echo "Wishlist a couple of products from any listing page, check the"
echo "heart icon in the header shows the right count, then open Account >"
echo "Wishlist to see real photos/prices and try Add to Cart."

#!/usr/bin/env bash
# Deploys the storefront visual restyle — ports the reference design in
# theme/ (a luxury/editorial look: Playfair Display + Outfit fonts, an
# ivory/sand/champagne/jet/charcoal/rose palette, pill buttons, rounded-2xl
# cards) onto the real, backend-connected storefront across all 6 requested
# areas: Home, Listing (PLP), Product Detail Page, Cart page, Mini-cart,
# and My Account.
#
# Storefront only — no backend/admin changes, no migration, no new
# permission. Every page still reads the exact same real data/services it
# did before; this is a visual-layer change, plus two small pieces of real
# new functionality:
#   - The shared product card gained a real hover "Quick Add" button and a
#     real wishlist heart (wired to the existing cart/wishlist stores).
#   - The Account Overview page gained real stat tiles (order count,
#     wishlist count, and a loyalty-points balance when this store has an
#     active rewards program).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-storefront-restyle.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding storefront (full visual restyle, all 6 pages)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission, no other"
echo "service touched — this is storefront-only."
echo
echo "Every page keeps its real data/logic exactly as before (cart, coupons,"
echo "wishlist, orders, addresses, pincode checker, offers, reviews, the"
echo "multi-store switcher) — only the visual layer changed."

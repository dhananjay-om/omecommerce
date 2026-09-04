#!/usr/bin/env bash
# Finishes the wishlist feature — the backend module (create/list/add/
# remove, customer-auth gated) and the storefront's /api/wishlist proxy
# routes already existed and were already real, but the actual heart-icon
# affordance a shopper clicks was never fully wired to them:
#
#   - The product-card heart (used on Home, every PLP grid, and every
#     product carousel — by far the most common wishlist entry point) was
#     100% local browser state. Clicking it never called the backend at
#     all, so it never showed up in Account > Wishlist and vanished on
#     refresh.
#   - The PDP's two heart buttons DID write to the backend one-way, but
#     never READ it back — so a product you'd already wishlisted showed an
#     empty heart again on your next visit or on another device.
#   - Nothing gated any of this on being logged in — a guest's click
#     silently "worked" locally and went nowhere, instead of prompting
#     them to log in (the wishlist module has no guest concept; a real
#     customer id is required).
#
# Now every heart icon across the app (product cards, PDP gallery, PDP
# action panel) shares one real, backend-backed store: it hydrates the
# logged-in customer's actual wishlist on load (via the header, the same
# place cart/auth already hydrate), every toggle is a real POST/DELETE
# with an optimistic update that reverts on failure, a logged-out click
# shows a clean "Log in to save items to your wishlist" toast instead of a
# fake local change, and removing an item from Account > Wishlist now
# syncs back to every heart icon elsewhere too. Also hardened the 2
# /api/wishlist route handlers to fail cleanly (401) instead of crashing
# unhandled when hit while logged out.
#
# Storefront only — no backend/admin changes, no migration, no new
# permission (the backend wishlist module and its permission already
# existed; this was purely finishing the storefront wiring to it).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-wishlist-fix.sh
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
echo "Log in as a real customer, hover a product card on any listing page"
echo "and click the heart, then reload the page — it should stay filled."
echo "Check Account > Wishlist to see the same item there for real, and"
echo "try clicking a heart while logged out to see the login prompt."

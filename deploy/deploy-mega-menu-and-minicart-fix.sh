#!/usr/bin/env bash
# Two storefront-facing fixes, shipped together:
#
# 1) Mega Menu — a new, separately admin-manageable header nav. Admin gets
#    Content > Mega Menu: create top-level nav items with dropdown columns
#    (heading + links) and an optional promo image (real presigned-upload
#    flow, same as Banner's). New `mega_menu_item` table + `navigation:manage`
#    permission. The storefront's desktop mega menu and mobile drawer both
#    render these admin-managed items once at least one exists; with ZERO
#    items configured, both fall back to the exact original auto-generated-
#    from-category-tree behavior, unchanged — so this can't break a site
#    that hasn't touched the new page yet.
#
# 2) Mini-cart "View Cart" bug fix — clicking "View Cart" in the mini-cart
#    drawer correctly navigated to /cart, but the drawer itself stayed open
#    over the cart page. Fixed by making the drawer's open state controlled
#    and closing it on click, before navigating.
#
# New permission this time: navigation:manage — needs Sync Permissions +
# relogin (steps below).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-mega-menu-and-minicart-fix.sh
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

echo "==> Applying the new mega_menu_item table"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Content > Mega Menu)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (mega menu render + mini-cart fix)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. One more manual step required:"
echo "    1. Log in to admin, go to Stores > Admin Permissions > Sync Permissions."
echo "    2. Log out and back in (your session needs the new"
echo "       navigation:manage permission before Content > Mega Menu will work)."
echo
echo "Try it:"
echo "  - Content > Mega Menu > New Item — add a label, link, a column or two"
echo "    of links, and (optionally) a promo image, save it active, then check"
echo "    the real storefront header — it should replace the auto-generated"
echo "    category nav for that item. Delete it and the header falls back"
echo "    to the original category-tree nav automatically."
echo "  - Add something to cart on the storefront, open the mini-cart, click"
echo "    'View Cart' — the drawer should close and only the cart page shows."

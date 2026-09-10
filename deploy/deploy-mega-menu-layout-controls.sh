#!/usr/bin/env bash
# Mega Menu addon: admin-configurable dropdown layout.
#
# Adds 5 new optional settings to each mega-menu item, all under the
# existing Content > Mega Menu editor:
#   - Panel width (px)              — the dropdown's overall width
#   - Spacing between columns (px)  — gap between the column blocks
#   - Promo image position          — left / right / top / bottom,
#     relative to the (always-horizontal) row of columns
#   - Promo image width / height (px)
#
# Every field is optional — leaving them blank keeps the exact same look
# the dropdown already had (right-positioned image, 448px min width,
# 24px column gap), so no existing mega menu item changes appearance
# after this deploy until an admin actually opens it and sets one.
#
# No new permission — reuses the existing navigation:manage.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-mega-menu-layout-controls.sh
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

echo "==> Applying the new mega_menu_item layout columns"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Content > Mega Menu > Dropdown Layout / Promo Panel)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (renders the new layout settings)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission — if navigation:manage already"
echo "works for you, nothing else to sync."
echo
echo "Try it: Content > Mega Menu > edit any item with a dropdown or promo"
echo "image — new 'Dropdown Layout' and 'Image position' fields appear."
echo "Set a panel width, a column gap, and try 'Above columns' or 'Below"
echo "columns' for the image position, then check the real storefront header."

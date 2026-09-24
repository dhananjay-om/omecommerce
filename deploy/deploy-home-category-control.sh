#!/usr/bin/env bash
# "Show on Home Page" control for the home page's "Shop by Category" section.
#
# Before: the section showed EVERY top-level category (no limit, no way to
# choose) unless a Category Grid widget overrode it.
# Now: each category has a "Show on Home Page" setting (Categories > edit).
# The section shows exactly the categories set to Yes, in Position order
# (lowest first), so you control both which ones and how many. Subcategories
# can be featured too. A Category Grid widget with hand-picked categories
# (Content > Widgets) still takes priority if you have one.
#
# The migration marks every EXISTING top-level category as "Show on Home Page",
# so the home page looks the same right after deploying — then untick any you
# don't want (for example a "Home page" category) in Categories > edit.
#
# One migration (a safe, additive column). No new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-home-category-control.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (category show_on_home field)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the category show_on_home migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Show on Home Page setting on the category form)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (home page reads the new setting)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. In Admin > Categories, edit a category and use 'Show on Home Page'"
echo "(Yes/No) and 'Position' to control what appears in Shop by Category."

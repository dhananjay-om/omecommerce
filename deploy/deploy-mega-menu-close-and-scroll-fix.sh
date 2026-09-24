#!/usr/bin/env bash
# Two storefront header fixes:
#
# 1) The mega menu stayed open after clicking a link in it (the cursor was
#    still hovering and the clicked link was still focused, so the CSS
#    hover/focus rules kept it showing over the next page). It now closes
#    on click. The mobile menu drawer had the same problem — it now closes
#    when you tap a link too.
#
# 2) The whole home page had a sideways scrollbar and content looked cut off
#    at the left/right edges. Cause: the (invisible) mega menu dropdown was
#    anchored to its own link and stuck out past the right edge of the
#    window. It's now centered under the nav and clamped to the window.
#
# Storefront only — no migration, no permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-mega-menu-close-and-scroll-fix.sh
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
echo "==> Deploy complete. Hard-reload the home page (Ctrl+Shift+R): no"
echo "sideways scrollbar, and clicking a mega menu link closes the menu."

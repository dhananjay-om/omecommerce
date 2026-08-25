#!/usr/bin/env bash
# Deploys admin UI revamp Phase 2 (a through q, plus the follow-up fixes):
# every real page restyled to match the "Meridian Commerce OS" mock, on top
# of the Phase 0/1 shell (deploy-admin-ui-revamp-phase0.sh) already live.
#
#   - Orders: list grid, filters, detail header + stepper + items grid
#   - Products: list grid, filters, and the whole detail page rebuilt as one
#     tabbed view (Overview/Variants/Inventory/Pricing/Media/SEO + 6 honest
#     placeholder tabs) instead of a separate View + Edit page
#   - Categories: tree view + "Category Tree/Collections" tabs, edit page
#   - Customers, Discounts, Gift Cards, Loyalty & Referrals, Warehouses,
#     Companies: list grids restyled to the same look
#   - Every popup app-wide (shared Dialog component): darker backdrop,
#     wider body, real shadow, bordered header
#   - Login page: was a full-bleed 50/50 split that stranded its content at
#     the left/right edges on a wide monitor — now a single bounded card
#     centered on the page, with one consistent OMEcommerce brand mark
#     instead of 3 different logos/names on one screen
#   - Dashboard: was 3 plain counter cards + a basic table — now real KPIs,
#     an orders-by-status breakdown, a revenue trend chart, top products/
#     categories by revenue, and restyled Recent Orders + Inventory Risk
#     tables, all reusing the same real analytics endpoints /reports
#     already uses (no new backend work, no fabricated numbers)
#   - 2 real bugs fixed along the way: several pages' filter/search forms
#     were missing the /admin basePath on submit (plain <form> doesn't
#     respect it, next/form does); the sticky "Save Changes" bar used
#     `position: fixed` with a stale sidebar-width offset, causing it to
#     render partly behind the sidebar and leave a large dead gap on
#     shorter forms — switched to `position: sticky`, the correct tool for
#     that pattern
#
# Admin app only — no backend/migration changes in any of this.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-admin-ui-revamp-phase2.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin (Dashboard/Orders/Products/Categories/Customers/"
echo "    Discounts/Gift Cards/Loyalty/Referrals/Warehouses/Companies"
echo "    restyled, every popup redesigned, login page + sticky Save bar +"
echo "    basePath form fixes)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. Nothing to configure — this is all visual/layout,"
echo "    no new settings or data to fill in. Worth a quick look at Orders,"
echo "    Products, and Categories first, since those changed the most."

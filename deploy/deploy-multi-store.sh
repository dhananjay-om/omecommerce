#!/usr/bin/env bash
# Deploys the multi-store feature:
#
#   1. Admin can create a new store (Website + Store + Store View together,
#      one combined action) — Stores > Websites, "New Store" — instead of
#      only being possible via prisma/seed.ts. Currency is set at creation
#      only; there's deliberately no edit-currency-later path (a cart's
#      currency is locked in permanently at creation, same reasoning as the
#      stale-currency bug fixed earlier this session).
#   2. A real storefront store switcher — the announcement bar's old static
#      "Ship to United States" text is now a real dropdown listing every
#      active store, currency included. Switching stores clears the
#      current cart (a fresh one is created automatically, in the newly
#      selected store's currency) and reloads the page.
#
# No new migration — Website/Store/StoreView already had every field this
# needed. No new permission — POST /admin/v1/websites reuses the same
# blanket admin authentication every other Stores route already requires
# (this module has never had fine-grained permission gates).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-multi-store.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (Create Store + public store list)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Stores > Websites page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (real store switcher, replaces the old static text)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission to sync."
echo
echo "To add a second store: register its currency first if it isn't"
echo "already (Stores > Currency Setup), then Stores > Websites > New Store."
echo "The storefront switcher will list it automatically — no restart needed"
echo "for that part, it reads live from the database on every page load."
echo
echo "Not covered by this pass (by design, see the plan): deleting a store,"
echo "separate catalogs per store (both stores share one catalog, only"
echo "currency/price/tax/shipping differ), and admin list pages (Orders,"
echo "Products, ...) filtering by the topbar's store selector — that chip"
echo "stays informational-only, same as before."

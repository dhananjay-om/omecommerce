#!/usr/bin/env bash
# Fixes a real bug found by the user's own live Shopify migration run:
# collections were being created locally, but products almost never got
# assigned to them.
#
# Root cause: category membership was read from Shopify's /collects.json
# endpoint, which ONLY returns manual collection memberships — a smart/
# automated collection (rule-based, e.g. "everything tagged Summer") has
# no collect rows at all, Shopify computes its membership dynamically.
# The collection itself still got created (listCategories() sees every
# collection regardless of type), but zero products ever linked to it if
# it was a smart collection.
#
# Fixed by reading each collection's own /products.json endpoint instead
# — the one Shopify endpoint that returns real membership correctly for
# BOTH collection types (one paginated read per collection, not per
# product, so it stays cheap).
#
# Backend only — no schema/migration/permission change. Re-run "Check
# Migration" + "Start Migration" after this deploy to pick up the fix for
# categories that were missed on an earlier run (existing correctly-
# migrated products/categories are untouched either way).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-migration-category-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (Shopify collection-membership fix)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Run Check Migration + Start Migration again on your existing Shopify"
echo "connection — products that were skipped before because they already"
echo "exist locally will just show up in the skipped list (harmless);"
echo "products that DID import without a category will now get assigned"
echo "one on this run if they belong to a collection."

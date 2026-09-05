#!/usr/bin/env bash
# Data Migration: Order migration (Shopify), the third and last of the
# original Catalog/Customer/Order scope — plus the same Stop button.
#
# New admin page: Data Migration > Orders. Uses the SAME Shopify
# connection Catalog/Customer migration already save. "Check Migration"
# does NOT call AI — an order's own fields have no mapping ambiguity; the
# one real unknown is checked directly: how many line-item SKUs already
# match a product in your local catalog.
#
# What "Start Migration" actually does — a HISTORICAL, READ-ONLY import:
#   - Real order data (totals, addresses, dates, status) copied in as-is.
#   - Each line item matched to a local product by SKU. An order with NO
#     matching line item is skipped entirely (never imported empty); an
#     order with SOME matching lines imports with just those — the order's
#     recorded totals stay the real historical numbers either way, never
#     recomputed from only the matched subset.
#   - An order whose currency doesn't match this store's default currency
#     is skipped (not converted, not guessed).
#   - NOTHING ELSE is replayed: no payment is captured, no stock is
#     reserved or decremented, no confirmation email is sent, no loyalty/
#     referral credit is earned. Financial/fulfillment status is copied
#     from the source as a label, not re-derived from real payment/
#     fulfillment records (none exist for a migrated order).
#   - An order already migrated in a previous run is skipped, never
#     duplicated — same Stop-then-resume guarantee as Catalog/Customer.
#
# Real, disclosed limitation: because no PaymentTransaction/Fulfillment
# records back a migrated order, admin actions that expect one (e.g.
# refunding through the normal flow) may behave differently on an imported
# order than on a normally-placed one — this wasn't exhaustively tested
# against every downstream screen, since the plan's own scope was
# specifically "read-only import, no payment/fulfillment actions
# replayed," not "indistinguishable from a real checkout."
#
# No schema change, no new permission (reuses migration:manage). Shares
# the existing catalog-migration queue/worker as a third job name
# (`migrate-orders`) — see queues.ts's own doc comment.
#
# Verified end-to-end this session with a local mock Shopify orders server
# (3000 synthetic orders, deliberately including one with no matchable SKU,
# one with a partially-matching line, and one in a mismatched currency):
# Check Migration correctly flagged all 3 in its plan warnings before
# Start was ever clicked. Start -> real progress -> Stop mid-run ->
# confirmed the exact real committed count directly in Postgres -> Check
# Migration + Start again -> COMPLETED with skippedItems exactly matching
# (every already-migrated order correctly skipped) -> confirmed a direct
# distinct-email count showed zero duplicates across all 3 runs combined.
# Confirmed directly in Postgres that NO OrderPlaced event fired for any
# imported order (no email/loyalty/referral side effects), that placed_at
# reflects the real historical date (not the import time), and that the
# order-history timeline shows a clear "Imported from Shopify" entry.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-migration-orders.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (order migration worker + routes)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (new Data Migration > Orders page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Open Data Migration > Orders — if you already connected Shopify on"
echo "the Catalog or Customers page, it's already connected here too."
echo "Run Catalog migration first if you haven't — order line items match"
echo "against your local catalog by SKU."

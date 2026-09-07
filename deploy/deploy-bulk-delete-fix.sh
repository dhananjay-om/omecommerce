#!/usr/bin/env bash
# Bulk delete: Customers (added), Orders (UX fix), Products (added).
#
#   - Customers: had no bulk-select/delete at all. Added the same
#     checkbox-select + bulk action bar Orders already has, plus a new
#     bulkDeleteCustomers action. DeleteCustomer has no eligibility gate
#     (soft-delete/deactivate, never blocked), so every selection succeeds.
#   - Orders: bulk delete already worked at the API level, but
#     DeleteOrder only ever allows CANCELLED/CLOSED orders (a real,
#     pre-existing business rule — you shouldn't be able to permanently
#     delete an active/paid order). The bulk checkboxes didn't apply
#     that rule, so selecting a normal order and clicking Delete
#     silently reported "0 deleted, N skipped" for every one, which
#     looked broken. Fixed: ineligible checkboxes are now disabled (with
#     a tooltip), "Select all" only selects eligible rows, and — since a
#     page of all-active orders would otherwise show nothing but
#     mysteriously-disabled checkboxes — an explicit note now explains
#     why when that happens.
#   - Products: had no bulk delete at all (only bulk Activate/Deactivate
#     and Generate Missing Descriptions). Added a Delete button to that
#     same bulk bar + a new bulkDeleteProducts action. DeleteProduct
#     rejects a product that still has stock (adjust to zero first) —
#     unlike Orders, the checkboxes here are shared with the other bulk
#     actions that have no such restriction, so they aren't gated the
#     same way; an ineligible product is reported back per-item instead
#     ("Deleted X, N skipped: ...", same shape as Orders/Customers).
#
# Admin-only change. No backend/schema change, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-bulk-delete-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Customers and Products now both have bulk-select + Delete."
echo "    On Orders, only cancelled/closed orders can be selected for bulk"
echo "    delete — cancel an order first if you need to delete it. On"
echo "    Products, a product with stock is reported as skipped rather"
echo "    than blocking selection — adjust its stock to zero first."

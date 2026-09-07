#!/usr/bin/env bash
# Bulk delete: Customers (added), Orders (fixed twice), Products (added).
#
#   - Customers: had no bulk-select/delete at all. Added the same
#     checkbox-select + bulk action bar Orders already has, plus a new
#     bulkDeleteCustomers action. DeleteCustomer has no eligibility gate
#     (soft-delete/deactivate, never blocked), so every selection succeeds.
#   - Products: had no bulk delete at all (only bulk Activate/Deactivate
#     and Generate Missing Descriptions). Added a Delete button to that
#     same bulk bar + a new bulkDeleteProducts action. A product with
#     stock is reported back as skipped rather than blocking selection
#     (adjust its stock to zero first, then delete).
#   - Orders, round 2 (this pass — an api change, not just admin): the
#     first fix disabled the checkbox for any order that wasn't already
#     CANCELLED/CLOSED — correct for a normal checkout order (an active
#     order may have a live stock hold / unsettled payment, which really
#     shouldn't be deleted out from under), but WRONG for an order
#     brought in by the Shopify/Magento migration feature — those never
#     touch stock or a payment gateway at all (see createImported()'s own
#     doc comment), so there's nothing to leak regardless of status, and
#     during development a store may have hundreds of these to clean up.
#     DeleteOrder now allows deleting an imported order (detected via its
#     own 'ORDER_IMPORTED' timeline entry) at ANY status, and the bulk
#     checkboxes are unrestricted again — select freely, and the bulk
#     action's own result reports exactly what was deleted vs skipped
#     and why, same shape as Products.
#
# Verified against local dev: a real order carrying an 'ORDER_IMPORTED'
# history entry deletes cleanly regardless of status; a real, normal
# (non-imported) order still correctly rejects the same request (409) —
# the safety guard for real checkout orders is unchanged.
#
# api + admin change this time (previous runs of this script only touched
# admin) — no migration, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-bulk-delete-fix.sh
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

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Customers and Products both have bulk-select + Delete."
echo "    On Orders, you can now select and bulk-delete migrated orders"
echo "    (from Data Migration) regardless of their status — a real,"
echo "    normally-placed order still needs to be cancelled or closed"
echo "    first, same as before."

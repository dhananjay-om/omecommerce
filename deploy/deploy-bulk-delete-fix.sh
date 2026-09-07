#!/usr/bin/env bash
# Bulk delete: Customers (new) + Orders (fixed UX).
#
#   - Customers list had no bulk-select/delete at all — only a per-row
#     "..." menu. Added the same checkbox-select + bulk action bar the
#     Orders list already has, and a new bulkDeleteCustomers action
#     (deletes what's selected in parallel, same Promise.allSettled
#     shape as bulkDeleteOrders). DeleteCustomer has no eligibility gate
#     (it's a soft-delete/deactivate, never blocked), so every selected
#     customer succeeds.
#   - Orders' bulk delete already existed and DID work — but only for
#     CANCELLED/CLOSED orders (DeleteOrder's own real business-rule
#     guard, same one the row-level "Delete Order" menu item already
#     respects). Selecting a typical active order and clicking bulk
#     Delete silently reported "0 deleted, N skipped" for every one,
#     which looked broken. Fixed by disabling the checkbox (with a
#     tooltip explaining why) for any order that isn't eligible, and
#     "Select all" now only selects the eligible ones — so bulk delete
#     only ever offers what it can actually delete, same rule enforced
#     before the click instead of after.
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
echo "==> Done. Customers now has the same bulk-select + Delete bar as"
echo "    Orders. On Orders, only cancelled/closed orders can be selected"
echo "    for bulk delete — cancel an order first if you need to delete it."

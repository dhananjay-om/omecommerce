#!/usr/bin/env bash
# Fixes "cart ... is not active (already checked out or abandoned)" on the
# checkout page after a first "Place Order" attempt failed.
#
# Cause: pressing Place Order marks the cart as "checked out" at the very start.
# If anything then failed (payment declined, item ran out of stock, a coupon
# stopped being valid, ...) the cart stayed marked as checked out, so every retry
# with that same cart was refused.
#
# Now:
#   - If a checkout attempt fails before the order is paid, the cart goes back to
#     active automatically, so the customer fixes the problem (or just retries)
#     with the same cart and items. The failed order stays in the admin as a
#     cancelled/failed order for the record, but no longer blocks the cart.
#   - A cart that is ALREADY stuck like this (from before this fix) heals itself
#     the next time the customer presses Place Order (as long as the failed
#     attempt is more than 2 minutes old).
#   - A cart whose order really was paid is never reopened, so nobody can be
#     charged twice, and a double-click while an order is still being placed
#     doesn't cancel it.
#
# API only. No migration, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-checkout-retry-fix.sh
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

echo
echo "==> Done. On the checkout page with the stuck cart, press Place Order again."

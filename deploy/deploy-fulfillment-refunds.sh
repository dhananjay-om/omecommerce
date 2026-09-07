#!/usr/bin/env bash
# Fulfillment: Refunds — Phase 3 of 5 (Pick & Pack / Shipments /
# Delivery / Returns / Refunds).
#
# Every refund's data was already fully real — every refund RefundOrder
# issues writes a real PaymentTransaction row (method, gateway, amount,
# currency, status, gatewayRef, createdAt). The only gap was a cross-order
# view: today that history was only visible one order at a time.
#
#   - Admin > Fulfillment > Refunds: every refund across every order,
#     filterable by method/status/date range, with a real "total
#     refunded" stat per currency (never summed across currencies into
#     one misleading number — this store can hold orders in more than
#     one currency).
#
# One real, disclosed limitation: PaymentTransaction has no `reason`
# column, so filtering by refund reason (mentioned in the original nav
# roadmap copy) isn't possible without a schema change — left out of this
# pass rather than faked.
#
# No schema change, no new permission — reuses orders:view, the same
# permission Shipments/Delivery already required for viewing.
#
# Verified end-to-end against local dev, real data (23 real refunds
# already in the system from this project's own earlier testing):
# confirmed the list, the per-currency total ($24,898.00 USD, correctly
# summed only from same-currency rows), and the method/status filters all
# return correct, genuinely different real counts (e.g. method=wallet
# correctly returns 0 — no fabricated matches). Confirmed the real admin
# page itself server-renders the correct data (fetched the live page with
# a real session cookie, not just the API). tsc/lint/build clean on both
# apps (0 new errors/warnings). 45/45 backend unit tests pass.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-fulfillment-refunds.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (cross-order Refunds ledger)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Fulfillment > Refunds page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Open Fulfillment > Refunds — every refund already issued shows up"
echo "there immediately."

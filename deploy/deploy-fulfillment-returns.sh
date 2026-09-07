#!/usr/bin/env bash
# Fulfillment: Returns — Phase 4 of 5 (Pick & Pack / Shipments / Delivery
# / Returns / Refunds).
#
# The biggest gap of the 5: OrderReturn/OrderReturnLine already existed in
# the schema (even read by the order detail page's own DTO) but NOTHING
# anywhere ever created or updated one. This closes that write path.
# Admin-recorded only (confirmed decision — no customer self-service in
# this pass): an admin logs a return that already happened over phone/
# email/support.
#
#   - Order detail page: a new "Create Return" button/dialog (next to the
#     existing Fulfill/Refund ones) — reason + per-line qty/restock.
#   - Admin > Fulfillment > Returns: the cross-order queue. Each return
#     moves REQUESTED -> APPROVED -> RECEIVED, with Approve/Mark Received/
#     Reject buttons.
#   - "Refund" is its OWN action, not another status option — it
#     genuinely moves money by reusing the existing, already-proven
#     RefundOrder usecase (no second refund engine). A return's restock
#     flag is per LINE; RefundOrder's own restock flag is one for the
#     whole call, so a return with mixed restock lines correctly calls
#     RefundOrder up to twice (once per restock value) rather than
#     fabricating one flag that would silently mis-restock some lines.
#
# No schema change (OrderReturn/OrderReturnLine already existed), no new
# permission — reuses orders:refund (create/status-change/refund) and
# orders:view (the cross-order list), the same two permissions this
# feature area already required.
#
# Verified end-to-end against local dev, real data: created a real return
# on a real fulfilled order, confirmed an illegal transition (REQUESTED ->
# RECEIVED, skipping APPROVED) is correctly rejected with a clean 409,
# walked it through Approve -> Mark Received -> Refund for real, and
# confirmed EVERYTHING downstream actually happened: the order's
# financialStatus flipped to REFUNDED, a real $75.00 PaymentTransaction
# appeared in the Refunds ledger built in Phase 3 (proving the two phases
# genuinely compose), the line's refundedQty incremented, the restock
# flag was honored, a real "Refund issued" email fired (the same one
# RefundOrder already sends), and the order's own history timeline shows
# every real step in order. Separately created and rejected a second
# return, confirmed a rejected return cannot be refunded (a clean 409,
# not silently allowed). Confirmed both real admin pages render correctly
# with a real session cookie — the order detail page's new "Create
# Return" button and the cross-order Returns queue showing both real
# returns with their correct statuses. tsc/lint/build clean on both apps
# (0 new errors; admin: +2 `_prevState` warnings, the established
# per-new-no-formData-action pattern). 45/45 backend unit tests pass.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-fulfillment-returns.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (Returns create/status/refund + cross-order list)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Create Return dialog + Fulfillment > Returns page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Open an order and click Create Return to log one, or go to"
echo "Fulfillment > Returns to process ones already logged."

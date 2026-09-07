#!/usr/bin/env bash
# Fulfillment: Pick & Pack — Phase 5 of 5 (final phase). Pick & Pack /
# Shipments / Delivery / Returns / Refunds are now ALL live.
#
# The one genuinely new domain in this whole feature area — no pick-list/
# bin-location concept existed anywhere in the codebase before this (every
# other phase was a cross-order view over data that already existed).
#
#   - New, small schema addition: StockItem.binLocation (nullable
#     free-text, e.g. "A3-12") — an admin optionally records where a
#     variant's stock physically sits at a warehouse. A pick list still
#     works with none set, it just shows "Unassigned" — never a
#     fabricated location.
#   - Admin > Fulfillment > Pick & Pack: a real queue of every paid,
#     not-yet-fully-fulfilled order, OLDEST FIRST (real FIFO picking
#     priority — the opposite default of every other list page in this
#     app). Each pick ticket shows what still needs picking with its real
#     bin location (editable inline, right where it's used), and a
#     "Pack & Ship" button that's the EXACT SAME FulfillDialog the order
#     detail page already uses — no second fulfillment write path to keep
#     in sync with the real one.
#   - Deliberately does NOT add "package type/weight capture" (the
#     original nav copy's own promise) — no real field or downstream
#     consumer for that data exists, and this pass doesn't invent one
#     just to match old placeholder copy; the nav description was
#     reworded to describe what's actually built.
#
# One schema migration (new nullable column, safe/additive). No new
# permission — reuses orders:view (viewing the queue) and inventory:adjust
# (editing a bin location, the same permission class as every other stock
# write).
#
# Verified end-to-end against local dev, real data: fetched the real pick
# list (87 real paid/unfulfilled orders, oldest first, correct real
# resolved warehouse); set a real bin location for a real SKU and
# confirmed it appeared correctly across EVERY order needing that SKU
# (proving it's genuinely a shared warehouse-location record, not
# per-order data) and cleared it back to null cleanly; used the reused
# FulfillDialog's own route to actually pack a real order, confirmed it
# immediately dropped off the Pick & Pack queue (87 -> 86) and — proving
# real cross-phase composition, not just phase-5-in-isolation — the exact
# same fulfillment appeared correctly in the Phase 1 Shipments list.
# Confirmed the real admin page server-renders the correct data (fetched
# the live page with a real session cookie). tsc/lint/build clean on both
# apps (0 new errors/warnings). 45/45 backend unit tests pass.
#
# Also fixed while wiring this phase: FulfillOrder/RefundOrder's own
# revalidatePath calls didn't cover the new cross-order Fulfillment pages
# at all (they predate this feature area) — extended so packing/refunding
# an order from its own detail page correctly refreshes Pick & Pack /
# Shipments / Delivery / Refunds too, not just that one order's page.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-fulfillment-pick-pack.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (pick list + bin-location + revalidation fixes)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new stock_item.bin_location column"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Fulfillment > Pick & Pack page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission."
echo "Open Fulfillment > Pick & Pack — every paid, unfulfilled order shows"
echo "up there immediately, oldest first."
echo
echo "==> This completes the whole Fulfillment feature area — Pick & Pack,"
echo "Shipments, Delivery, Returns, and Refunds are all now live."

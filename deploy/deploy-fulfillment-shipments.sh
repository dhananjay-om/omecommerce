#!/usr/bin/env bash
# Fulfillment: Shipments — Phase 1 of 5 (Pick & Pack / Shipments /
# Delivery / Returns / Refunds).
#
# The shipment/tracking data was already fully real — every fulfillment
# (FulfillOrder, already shipped earlier) creates a real Fulfillment +
# ShipmentTracking row with carrier/tracking#/ETA/notes. The only real gap
# was a cross-order view: today that data was only visible one order at a
# time, on that order's own Shipments tab. This adds:
#
#   - Admin > Fulfillment > Shipments: every shipment across every order,
#     filterable by status/carrier/date range, with a link back to its
#     order.
#   - An "Edit tracking" action per row — the one genuinely missing write
#     path (FulfillOrder only ever sets tracking once, at creation time).
#     Blank fields are left unchanged, never cleared, when editing.
#
# No schema change, no new permission — reuses orders:view (viewing
# shipments) and orders:fulfill (editing tracking), the same two
# permissions this feature area already required.
#
# Verified end-to-end against local dev, real data: fulfilled a real
# paid/unfulfilled order with real carrier/tracking info, confirmed it
# appeared immediately in the new cross-order list (and correctly
# filtered by status/carrier); edited its tracking number via the new
# PATCH route, confirmed the change persisted AND a real "TRACKING_UPDATED"
# line appeared on that order's own history timeline; confirmed both the
# list and edit routes reject unauthenticated requests; confirmed the
# real admin page itself server-renders the real updated data (not just
# the API). tsc/lint/build clean on both apps (0 new errors/warnings).
# 45/45 backend unit tests pass.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-fulfillment-shipments.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (cross-order Shipments list + edit-tracking route)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Fulfillment > Shipments page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Open Fulfillment > Shipments — every shipment you've already created"
echo "shows up there immediately."

#!/usr/bin/env bash
# Fulfillment: Delivery — Phase 2 of 5 (Pick & Pack / Shipments /
# Delivery / Returns / Refunds).
#
# Same real Fulfillment/ShipmentTracking data Shipments already surfaces
# (Phase 1) — this page leads with delivery/SLA state instead of carrier
# detail:
#
#   - Admin > Fulfillment > Delivery: a real delivered/in-transit/delayed/
#     cancelled breakdown (stat tiles) above a filterable list.
#   - "Delayed" is a real, computed flag — not yet DELIVERED/CANCELLED and
#     past its estimated delivery date — never a fabricated SLA metric. A
#     shipment with no ETA at all is correctly treated as "not delayed"
#     (nothing to be late against).
#   - Reuses the same "Edit tracking" action Shipments already has (one
#     mutation for one resource, shown from two views).
#
# No schema change, no new permission — reuses orders:view/orders:fulfill,
# the same two permissions Shipments already required.
#
# Verified end-to-end against local dev, real data: fulfilled a real
# order with a past-dated ETA, confirmed it counted correctly in the
# breakdown (delayed: 1) and showed up under the "Delayed only" filter
# with the real Delayed badge, and confirmed a genuinely-caught filter bug
# — `delayed=false` was silently behaving like "no filter" instead of
# "show non-delayed only" — is now fixed and verified both ways
# (delayed=true / delayed=false / no filter each return the correct,
# different real counts). Confirmed the real admin page itself
# server-renders the correct data (fetched the live page with a real
# session cookie, not just the API), both filtered and unfiltered.
# tsc/lint/build clean on both apps (0 new errors/warnings). 45/45
# backend unit tests pass.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-fulfillment-delivery.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (delivery breakdown + delayed filter)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Fulfillment > Delivery page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Open Fulfillment > Delivery — the breakdown and list reflect your"
echo "real shipments immediately."

#!/usr/bin/env bash
# Data Migration: Magento connector — the second source channel, now real
# for all 3 data types (Catalog, Customers, Orders), same engine Shopify
# already uses.
#
# Auth: paste a Magento Integration Access Token (Admin > System >
# Extensions > Integrations > create or open one > Activate to get its
# token) — same "paste a token, not full OAuth" shape as Shopify.
#
# Each of the 3 Data Migration pages (Catalog / Customers / Orders) now
# has a Shopify/Magento tab at the top — switching tabs shows that
# channel's own connection and its own independent Check Migration /
# Start / Stop run history. Connecting on any page's Magento tab makes
# all 3 pages see it.
#
# What's genuinely different under the hood for Magento (all handled by
# the new connector, not something you need to do anything about):
#   - A configurable product's real variants live on separate child
#     products — fetched and matched to their real Color/Size values via
#     Magento's own attribute-options API, not left as raw numeric codes.
#   - Magento's order model has one combined `status` field, not Shopify's
#     separate financial/fulfillment split — this is derived from status +
#     paid/refunded amounts so it lands in the same real REFUNDED/PAID/
#     FULFILLED-style status your Shopify-imported orders already use.
#   - Magento categories form a real tree; they're still created as
#     flat/root-level locally for now (a known limitation — the engine
#     itself doesn't build category hierarchy yet, this isn't specific to
#     Magento).
#
# No schema change, no new permission (MAGENTO was already a valid
# channel value everywhere — only a real connector was missing).
#
# Verified end-to-end this session with a local mock Magento REST server
# (products — one simple, one configurable with 2 real color variants;
# categories; customers with addresses; orders including a configurable
# purchase's real Magento item-row shape): Check Migration produced a real
# AI-generated catalog plan referencing the mock store's real category/
# attribute names; Start created the real categories/products/variants,
# with each generated variant's Color correctly resolved to "Red"/"Blue"
# (not Magento's raw internal option codes) — confirmed directly in
# Postgres. Customer migration created real customers + addresses.
# Order migration correctly matched an order's customer to the
# already-migrated customer, correctly kept only the real simple-product
# line row from a configurable purchase (discarding Magento's zero-price
# parent grouping row), and correctly derived FULFILLED+PAID+COMPLETED /
# PARTIALLY_FULFILLED+PAID+CONFIRMED / UNFULFILLED+PENDING+CONFIRMED for
# 3 orders in different real states — all confirmed directly in Postgres.
# All test data deleted afterward.
#
# NOT verified against a real live Magento store (none was available this
# session) — same disclosed limitation Shopify's own first pass had,
# before the user's real store surfaced one real bug. Magento's REST API
# has more real-world configuration variance than Shopify's (custom
# attribute sets, EAV quirks, extension modules), so treat this the same
# way: report back anything that looks wrong against your real catalog and
# it'll get fixed the same way the Shopify collects.json bug did.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-migration-magento.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (Magento connector for Catalog/Customer/Order migration)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Shopify/Magento tabs on each Data Migration page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Open any Data Migration page, click the Magento tab, and paste an"
echo "Integration Access Token from your Magento store to connect."

#!/usr/bin/env bash
# Data Migration: Customer migration (Shopify -> customer accounts +
# addresses), with the same Stop button as Catalog.
#
# New admin page: Data Migration > Customers. Uses the SAME Shopify
# connection Catalog migration already saves — connect once, both pages
# see it. "Check Migration" here does NOT call AI (a customer record has
# no real mapping ambiguity — see AnalyzeCustomers' own doc comment), so
# it's a plain, fast preview: total customers, how many in the sample have
# no email, how many have a duplicate email.
#
# "Start Migration" imports each customer (email, name, saved addresses) —
# a customer whose email already exists locally is skipped and logged,
# never overwritten, same policy as Catalog's SKU-conflict handling. A
# migrated customer gets a random, unknown password (no platform's API
# ever exposes real passwords) — they'll need a way to set a new one
# before they can sign in; this store doesn't have a self-service
# "forgot password" flow yet, so that's a real follow-up to plan for
# separately if wanted.
#
# The Stop button works exactly like Catalog's: a cooperative stop
# (finishes the customer currently in progress, then halts before the
# next one), and re-running Check Migration + Start later resumes safely
# with zero duplicates.
#
# No schema change, no new permission (reuses migration:manage). Both job
# types now share the existing catalog-migration queue/worker — see
# queues.ts's own doc comment.
#
# Verified end-to-end this session with a local mock Shopify server (since
# no real store was available): a real 500-customer Start -> Stop mid-run
# -> confirmed the exact real committed count directly in Postgres (289
# customers + 289 addresses) -> Check Migration + Start again -> COMPLETED
# with skippedItems matching exactly (289) and the DB confirming exactly
# 500 distinct customers/addresses, zero duplicates. Separately verified
# the raw "email already exists locally" skip path against a fresh batch
# with a genuinely pre-existing local customer never previously migrated —
# exactly 1 skip with the correct reason, the other 499 created, and the
# pre-existing customer's data confirmed untouched (not overwritten).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-migration-customers.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (customer migration worker + routes)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (new Data Migration > Customers page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Open Data Migration > Customers — if you already connected Shopify"
echo "on the Catalog page, it's already connected here too."

#!/usr/bin/env bash
# Data Migration: show WHY a product was skipped/failed, and show the REAL
# attributes (with real sample values) an Analyze plan will create/match —
# not just attribute SETS — so an admin can actually judge the plan before
# clicking Start.
#
# No schema change, no new permission — pure application code:
#   1. The Migration Plan card's "Variant attributes" section now lists each
#      real attribute (new or matched) plus a few real example values seen
#      on the source store (e.g. Color -> new attribute "color", values
#      seen: Red, Blue, Green) — this data was already being sent to the AI,
#      it just wasn't being returned in the plan or shown in the UI.
#   2. A finished run's summary now has a "View the N skipped/failed items
#      and why" link, expanding a table with each item's SKU and the real
#      reason the worker recorded (e.g. "a product with this SKU already
#      exists locally", "no SKU on the source product") — this data was
#      already being computed and stored, just never surfaced in the admin.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-migration-plan-details.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (plan now includes real attribute sample values)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (attribute plan detail + skip/fail reason list)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no permission change."
echo "Run Check Migration again to see a fresh plan with real attribute"
echo "values, and open a finished run's result to see the new skip/fail list."

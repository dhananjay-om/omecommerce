#!/usr/bin/env bash
# Deploys the new Data Migration feature (Catalog, Shopify) — a real, AI-
# assisted import pipeline, not a mock:
#
#   1. Connect: Stores > Data Migration > Catalog — paste a Shopify Admin
#      API access token (from a custom app: Shopify Admin > Settings >
#      Apps and sales channels > Develop apps). No OAuth install needed.
#      "Test Connection" makes a real call against the store.
#   2. "Check Migration" — reads the real catalog (count + a bounded
#      sample) and makes ONE OpenAI call (needs a key already saved under
#      AI Settings) to build a mapping plan: which Shopify options/product
#      types/collections match EXISTING local attributes/attribute sets/
#      categories vs. need to be created. Shown to the admin as a plain-
#      English summary + breakdown — no field-by-field mapping screen.
#   3. "Start Migration" — applies that plan deterministically (no further
#      AI calls) as a real background job on its own queue (deliberately
#      not sharing the CSV-bulk-import queue — see queues.ts's own doc
#      comment on why), with a live, polled progress bar. A product whose
#      SKU already exists locally is skipped and listed, never overwritten
#      — re-running a migration is always safe (nothing gets duplicated).
#
# Magento is NOT part of this deploy — Shopify ships first; Magento is a
# second connector on the same engine, added once Shopify is verified
# against a real store.
#
# New migration (migration_connection/migration_run/migration_external_ref
# tables) + 1 new permission (migration:manage) — needs the usual Sync
# Permissions + log-out/back-in step, see below.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-data-migration-shopify.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new migration module + catalog-migration worker)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new migration_connection/migration_run/migration_external_ref migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Data Migration > Catalog page + a shared apiGet fix)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo
echo "One manual step, in the admin UI: this shipped 1 new permission code"
echo "(migration:manage). Go to Stores > Admin Permissions and click Sync —"
echo "that grants it to your super-admin role — then LOG OUT AND BACK IN so"
echo "your session token actually carries it."
echo
echo "Before using Data Migration, make sure a real OpenAI key is already"
echo "saved under AI Settings — Check Migration needs it to build the"
echo "mapping plan and fails with a clear message otherwise."
echo
echo "To try it: Data Migration > Catalog, paste a real Shopify Admin API"
echo "token + store URL, Test Connection, Check Migration, review the plan,"
echo "Start Migration, watch the progress bar."

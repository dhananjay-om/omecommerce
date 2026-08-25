#!/usr/bin/env bash
# Deploys AI Insights (Track 1 of the AI features plan, Phase 1): a new
# rule-based insight engine (revenue swings, stockouts, payment-failure
# spikes, return-rate spikes, stuck orders, fulfillment slowdowns, new
# customers — see src/modules/ai/infrastructure/prisma-ai-insight.repository.ts's
# header comment for the full rule library), refreshed nightly at 02:30 UTC
# (15 min after the analytics nightly refresh it reads from) via the same
# BullMQ maintenance-queue pattern every other scheduled job here uses.
# Deliberately not LLM-based — every insight is a plain threshold rule over
# real numbers, same "explainable, not a model guess" philosophy the
# Dashboard's own Insights card already used, just persisted and exhaustive
# instead of computed live and capped at 4.
#
# New: a DELETE-free, additive-only `ai_insight` table (migration), a new
# GET /admin/v1/ai/insights endpoint, and a real /admin/ai/insights admin
# page replacing its ComingSoon placeholder. The other 3 AI nav items
# (AI Assistant, Forecasting, Recommendations) are untouched — still
# ComingSoon, still separate future work.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-ai-insights.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new ai_insight table + /admin/v1/ai/insights endpoint + ai:view permission + nightly refresh worker)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new ai_insight migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (real /ai/insights page replacing the placeholder)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo
echo "One manual step, in the admin UI: this shipped 1 new permission code"
echo "(ai:view). Go to Stores > Admin Permissions and click Sync — that"
echo "grants it to your super-admin role — then LOG OUT AND BACK IN so your"
echo "session token actually carries it."
echo
echo "The insight list will be EMPTY until the first nightly refresh runs"
echo "(02:30 UTC) — it reads the analytics summary tables for the trailing"
echo "7 days, which need real order activity in that window to have"
echo "anything to detect. To see it populated immediately instead of"
echo "waiting, run scripts/seed-demo-orders.mjs first (see deploy/seed-demo-orders.sh)"
echo "so there's real recent order data, and check back after the next"
echo "02:30 UTC run."

#!/usr/bin/env bash
# Deploys Recommendations — the last of the original 4-item AI nav group
# (Insights, Assistant, Forecasting, Recommendations all now live).
# 3 explainable rule-based suggestion kinds — RESTOCK and
# PROMOTE_SLOW_MOVER read Forecasting's own already-computed
# product_forecast rows directly, FEATURE_TRENDING_CATEGORY computes a new
# category-level 7-vs-prior-7-day revenue trend. Deliberately NOT
# LLM-based, same "explainable, not a model guess" philosophy as Insights/
# Forecasting. Refreshed nightly (same 02:30 UTC job, right after
# Forecasting — ordering matters, 2 of 3 kinds depend on fresh forecast
# output) or on demand via the page's own "Refresh now" button.
#
# Also fixes a real bug found while building this: Forecasting's own
# /ai/forecasting page was linking each product with the internal
# productId instead of its publicId (UUID) — every real /products/:id
# route is keyed by publicId, so that link 404'd. Fixed alongside, same
# deploy.
#
# New `merchandising_suggestion` table + GET/POST /admin/v1/ai/
# recommendations[/refresh] + a real /ai/recommendations card-list page
# replacing its ComingSoon placeholder. No new permission — reuses the
# existing `ai:view` permission Insights/Forecasting/Assistant already use.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-recommendations.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new merchandising_suggestion table + /admin/v1/ai/recommendations endpoints + nightly refresh extension + the Forecasting product-link bug fix)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new merchandising_suggestion migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (real /ai/recommendations card-list page replacing the placeholder + the fixed Forecasting product link)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync this time."
echo
echo "The table will be EMPTY until the first refresh runs (nightly at"
echo "02:30 UTC, right after Forecasting) — it needs a fresh Forecasting"
echo "pass (and real recent order/stock activity) to have anything to"
echo "suggest. Click 'Refresh now' on the page itself instead of waiting,"
echo "same as AI Insights/Forecasting."

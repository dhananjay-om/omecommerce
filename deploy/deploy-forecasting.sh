#!/usr/bin/env bash
# Deploys Forecasting — the last piece of Track 1 of the AI features plan.
# A statistical, product-grain sales forecast (trailing-14-day average
# daily sell rate, 7-vs-prior-7-day trend, days-of-cover, a high/medium/
# low stockout-risk tier) — deliberately NOT LLM-based, same "explainable,
# not a model guess" philosophy as AI Insights. Refreshed nightly (same
# 02:30 UTC job Insights already uses, right after it) or on demand via
# the page's own "Refresh now" button.
#
# New `product_forecast` table + GET/POST /admin/v1/ai/forecasts[/refresh]
# + a real /ai/forecasting table page replacing its ComingSoon placeholder.
# No new permission — reuses the existing `ai:view` permission Insights
# and Assistant chat already use.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-forecasting.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new product_forecast table + /admin/v1/ai/forecasts endpoints + nightly refresh extension)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new product_forecast migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (real /ai/forecasting table page replacing the placeholder)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync this time."
echo
echo "The table will be EMPTY until the first refresh runs (nightly at"
echo "02:30 UTC, right after AI Insights) — it needs real order activity"
echo "in the last 14 days to have anything to forecast. Click 'Refresh"
echo "now' on the page itself instead of waiting, same as AI Insights."

#!/usr/bin/env bash
# Deploys EVERYTHING currently on main that hasn't been rolled out to
# production yet, in one pass, instead of running each feature's own
# deploy-*.sh one at a time (deploy-ai-insights.sh, deploy-ai-settings.sh,
# deploy-ai-assistant.sh, deploy-forecasting.sh, deploy-recommendations.sh,
# deploy-ai-product-assistant.sh, deploy-ai-product-assistant-extras.sh,
# deploy-order-delete.sh, ...). Safe to run regardless of exactly which of
# those you already ran — `prisma migrate deploy` applies every pending
# migration and skips any already applied; rebuilding api/admin always
# picks up whatever's currently checked out.
#
# Covers, most recent first: 5 AI Product Assistant extras (create-page AI,
# per-image alt text, attribute-value suggestions, product reviews + AI
# summary, bulk "Generate Missing Descriptions"), the AI Product Assistant
# itself (Generate from Image + Quick Actions on the product edit page,
# plus a real Tags field), collapsible sidebar nav groups, a Dashboard
# Insights fix, AI Recommendations, Forecasting, AI Assistant, AI Insights,
# AI Settings, and hard delete for orders (single + bulk).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-all-pending.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api, admin"
$COMPOSE up -d --build api admin
if [ $? -ne 0 ]; then
  echo "!! build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying every pending database migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo
echo "==> Deploy complete. A few things to check, if you haven't already:"
echo
echo "1. Permissions: this batch reuses the ai:view/ai:manage/catalog:manage"
echo "   permissions from earlier deploys — nothing new to sync THIS time."
echo "   If AI Insights/AI Settings ever showed a 403 for you before, go to"
echo "   Stores > Admin Permissions > Sync Permissions, then log out and"
echo "   back in once, and it'll clear up."
echo
echo "2. OpenAI key: every AI feature (Insights, Assistant, Forecasting,"
echo "   Recommendations, the AI Product Assistant on each product page)"
echo "   needs a real key set in Stores > AI Settings to actually generate"
echo "   anything — without one, they show a clean 'needs an OpenAI key'"
echo "   message instead of a crash, so it's safe to deploy either way."
echo
read -rp "Seed a few realistic demo product reviews now, so the new Reviews tab's AI Summary has something real to summarize? [y/N] " REPLY
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  $COMPOSE exec api node scripts/seed-demo-reviews.mjs
else
  echo "==> Skipped — run ./deploy/seed-demo-reviews.sh any time later."
fi

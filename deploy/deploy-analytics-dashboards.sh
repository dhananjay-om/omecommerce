#!/usr/bin/env bash
# Deploys Phase 19's admin dashboard UI (6 report pages + Alert Rules config)
# on top of the analytics data pipeline/API deployed by
# deploy/deploy-analytics-reporting.sh. Adds 3 new backend read routes
# (customers/activity, customers/top, inventory/trend) that the dashboards
# need, plus a new frontend dependency (Recharts) — both api and admin
# containers get rebuilt. No new migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-analytics-dashboards.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding backend API (3 new analytics read routes)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! backend build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (new Reports section — 6 dashboards + Alert Rules)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. In the admin UI, a new 'Reports' rail item is now"
echo "    visible with 7 pages: Executive, Sales, Orders, Products, Customers,"
echo "    Inventory, Alert Rules. If you haven't already run"
echo "    deploy/deploy-analytics-reporting.sh's one-time permission-sync step"
echo "    (Stores > Admin Permissions > Sync, then log out/in), do that now —"
echo "    without it every Reports page 403s for every admin, including you."

#!/usr/bin/env bash
# Deploys Phase 19 (Analytics & Reporting): a new `analytics` migration (13
# tables), a new /admin/v1/analytics/* REST API, and two new background
# workers (event-driven projector + nightly refresh/alert-evaluation cron) —
# both run inside the existing `api` container/process, same as every other
# worker (see src/workers/index.ts), so there's no separate service to start.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-analytics-reporting.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding backend API (new analytics module + workers)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! backend build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new analytics migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo
echo "One manual step, in the admin UI: this shipped 4 new permission codes"
echo "(analytics:view, reports:export, reports:schedule, alerts:manage). Go to"
echo "Stores > Admin Permissions and click Sync — that grants them to your"
echo "super-admin role — then LOG OUT AND BACK IN so your session token"
echo "actually carries them (a JWT only reflects permissions as of the login"
echo "that issued it)."
echo
echo "No dashboard UI ships yet — this is the data pipeline + read API only."
echo "The nightly refresh runs at 02:15 UTC; until then, summary tables only"
echo "have whatever the live event-driven projector has filled in for today."
echo "You can sanity-check it's working with, e.g.:"
echo "  curl -s \"https://<your-domain>/admin/v1/analytics/sales?dateFrom=<today>&dateTo=<today>\" \\"
echo "    -H \"Authorization: Bearer <your admin token>\""

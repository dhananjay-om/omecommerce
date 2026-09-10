#!/usr/bin/env bash
# Reports: Marketing Analytics, Financial Analytics, Report Builder.
#
# Closes out the Analytics nav group's last 3 comingSoon placeholders:
#
#   - Marketing Analytics — coupon redemption performance/trend and the
#     referral signup->qualified->rewarded funnel, built on real
#     CouponRedemption/Referral data (no campaign/UTM attribution model
#     exists in this system, disclosed on the page itself, not faked).
#   - Financial Analytics — GST tax breakdown, payment method mix (an
#     already-wired route with its first real page), refunds/returns
#     trend, and live stored-value/receivables liability snapshots. NOT
#     a profit & loss report — this system has no product-cost data, the
#     page says so plainly.
#   - Report Builder — pick from 14 real reportable metrics + a date
#     range, run it, export CSV (the reports:export permission's first
#     real feature), or save the configuration to re-run later.
#
# One new table (saved_report). No new permission — reports:export
# already existed in the catalog, unused, until now; if your admin
# roles haven't been synced since it was added, run Stores > Admin
# Permissions > Sync Permissions once and relogin, same as any other
# permission gap.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-reports-marketing-financial-builder.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new saved_report table"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Reports > Marketing Analytics / Financial Analytics / Reports)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo
echo "If any admin role other than Super Admin needs CSV export access,"
echo "grant it reports:export under System > Roles & Permissions (Super"
echo "Admin already has every permission)."
echo
echo "Try it:"
echo "  - Reports > Marketing Analytics / Financial Analytics — both work"
echo "    immediately, no setup needed."
echo "  - Reports > Reports (the builder) — pick a metric, Run Report,"
echo "    try Export CSV, then Save This Report and confirm it shows up"
echo "    under Saved Reports with a one-click Run."

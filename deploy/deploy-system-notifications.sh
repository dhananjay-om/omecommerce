#!/usr/bin/env bash
# System: Notifications + the topbar bell (Phase 3 of 4).
#
# The topbar bell existed as a static shell ("no persistent notification
# model yet") — this makes it real. New `notification` table, fan-out at
# write time (one real row per recipient admin — no "broadcast" NULL
# row), no real-time push (no WebSocket/SSE exists anywhere in this
# codebase — the bell polls unread count every ~30s).
#
# Two real trigger sources, both wired to already-real machinery:
#   1. Every Alert Rule fire (Reports > Alerts' existing 6-metric
#      threshold engine — revenue drop, low stock, out of stock, payment
#      failure rate, return rate, stuck orders) now ALSO raises a bell
#      notification for every admin — zero setup required, since these
#      already run nightly.
#   2. A new Automation action, "Notify admins (in-app)", alongside the
#      existing Send Email / Call Webhook / Add Order Note — lets an
#      admin wire ANY of the 8 existing Rules/Workflows triggers (order
#      placed/paid/shipped/..., stock changed, customer registered) to
#      also raise a notification, entirely through the already-shipped
#      Rules/Workflows UI.
#
# No new permission — every notification route is scoped to the caller's
# own recipientId (any authenticated admin may read/mark their own).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-system-notifications.sh
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

echo "==> Applying the new notification table"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (real topbar bell, System > Notifications, and the"
echo "    new 'Notify admins' automation action)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync."
echo
echo "Try it:"
echo "  - If you have any Alert Rules configured (Reports > Alerts), the"
echo "    next time one's real threshold is crossed (checked nightly), you'll"
echo "    see it in the bell — no setup needed for that path."
echo "  - Automation > Workflows (or Rules) > New — pick any trigger, add a"
echo "    'Notify admins (in-app)' action, save it active, then trigger the"
echo "    real event (e.g. place a real order for an 'Order placed' rule) and"
echo "    check the bell a moment later."

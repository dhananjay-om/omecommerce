#!/usr/bin/env bash
# Deploys the order hard-delete feature: a new DELETE /admin/v1/orders/:id
# endpoint (backend), a new "Delete Order" action in the order detail
# page's "..." menu and a per-row + bulk "Delete" in the Orders list
# (admin frontend), and a bug fix in the analytics summary-refresh SQL
# that this feature exposed (a day's sales/product/category summary rows
# never zeroed out when a bucket regressed from having orders to having
# none — impossible before this feature, since orders couldn't disappear).
#
# Only CANCELLED/CLOSED orders can be deleted (a real guard, not just a UI
# hint — the backend rejects anything else with a 409). This is genuinely
# permanent: the order row and everything under it (line items, payments,
# fulfillments, invoices, history) is gone, no undo. Both `api` and `admin`
# need rebuilding — the API has the new endpoint/permission, the admin app
# has the new UI.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-order-delete.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new DELETE /admin/v1/orders/:id endpoint + orders:delete permission + analytics summary-refresh fix)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Delete Order in the order detail menu + Orders list row/bulk delete)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo
echo "One manual step, in the admin UI: this shipped 1 new permission code"
echo "(orders:delete). Go to Stores > Admin Permissions and click Sync — that"
echo "grants it to your super-admin role — then LOG OUT AND BACK IN so your"
echo "session token actually carries it (a JWT only reflects permissions as"
echo "of the login that issued it). Until you do this, Delete Order will"
echo "fail with a 403."

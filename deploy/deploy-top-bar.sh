#!/usr/bin/env bash
# Manage the storefront's top bar from the admin.
#
# The thin dark strip above the header (store switcher, phone number, promo
# message, "Track Order" and "Help" links) used to be hardcoded. Now:
#
#   Admin > Content > Top Bar  — one card per website (so e.g. India and US can
#   show different numbers/messages):
#     - show/hide the whole strip
#     - show/hide the store switcher ("Shipping to ...")
#     - phone number (tapping it calls on phones) — blank hides it
#     - promo / shipping message — blank hides it
#     - the links on the right: add, edit, reorder, remove (up to 6) — Track
#       Order, Help, or anything else (your own pages, https://, mailto:, tel:)
#     - "Reset to defaults"
#   Changes show on the store as soon as you save.
#
# Until you save something, every store shows exactly what it showed before
# (nothing changes on deploy). Links are validated: only pages on your store,
# https://, mailto: and tel: addresses are accepted.
#
# One migration (new top_bar_setting table). No new permission — it uses the
# same "manage navigation" permission as Content > Mega Menu.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-top-bar.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (top bar settings)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the top_bar_setting migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Content > Top Bar page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (top bar reads the settings)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Open Admin > Content > Top Bar to edit the phone number, message and links."

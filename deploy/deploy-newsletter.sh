#!/usr/bin/env bash
# Newsletter subscription — storefront sign-up forms (home page section +
# footer) now really subscribe people, plus an admin page to manage them.
#
#   - Storefront: both forms save the address, show a real success/error
#     message, and send a short welcome email (with a one-click unsubscribe
#     link — needs SITE_URL set on the api, which it already is for order
#     emails). A repeat sign-up is harmless; no duplicates. The made-up
#     "Join 24,000+ people" line is gone.
#   - Storefront: /newsletter/unsubscribe?token=... unsubscribe page (a
#     button press, so email link scanners can't unsubscribe anyone).
#   - Admin: Commerce > Newsletter — subscriber list (search, filter by
#     subscribed/unsubscribed), add, unsubscribe/resubscribe, delete, and
#     Export CSV.
#
# One migration (new newsletter_subscriber table) and ONE NEW PERMISSION,
# newsletter:manage — after this finishes, go to Stores > Admin Permissions
# and click "Sync Permissions", then log out and back in, so the admin menu
# item and page work for your account.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-newsletter.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (newsletter module)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the newsletter_subscriber migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Commerce > Newsletter page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (working sign-up forms + unsubscribe page)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Next: Admin > Stores > Admin Permissions > Sync Permissions,"
echo "then log out and back in. After that, Commerce > Newsletter shows your"
echo "subscribers. Try the footer or home-page form on the storefront."

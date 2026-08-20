#!/usr/bin/env bash
# Deploys the admin "Stores > Email (SMTP)" settings page: rebuilds
# api+admin with the new code and applies the new email_settings migration.
#
# After this runs, you can configure SMTP entirely from the admin UI —
# log in, go to Stores > Email (SMTP), fill in your Gmail/Google Workspace
# address and App Password, Save, then use "Send Test Email" to confirm it
# works. deploy/set-smtp-credentials.sh (server-side, from the previous
# update) still works too if you'd rather not use the UI — whichever was
# set more recently wins; the admin page's saved settings take priority
# over server env vars whenever both exist.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-smtp-settings-page.sh
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

echo "==> Applying database migrations"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. In the admin, go to Stores > Email (SMTP) to configure it."

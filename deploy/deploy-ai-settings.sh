#!/usr/bin/env bash
# Deploys AI Settings: an admin page (Stores > AI, "AI Settings") to save
# and test a real OpenAI API key, stored in the database rather than an env
# var — so it can be changed from the admin UI with no restart/redeploy.
# Same pattern as the existing SMTP settings page (Stores > Email
# Settings): singleton row, the key is never shown back once saved (only
# whether one is set), a real "Test API Key" call against the live OpenAI
# API, not just a format check.
#
# This ships the key-MANAGEMENT plumbing only — no feature reads the saved
# key yet (AI Assistant, planned next, will be the first). Safe to deploy
# and configure ahead of that.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-ai-settings.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new ai_settings table + /admin/v1/ai/settings endpoints + ai:manage permission + openai SDK dependency)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new ai_settings migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (new AI Settings page)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo
echo "One manual step, in the admin UI: this shipped 1 new permission code"
echo "(ai:manage). Go to Stores > Admin Permissions and click Sync — that"
echo "grants it to your super-admin role — then LOG OUT AND BACK IN so your"
echo "session token actually carries it."
echo
echo "Then go to AI > AI Settings, paste your real OpenAI API key, pick a"
echo "model, Save, then click 'Test API Key' to confirm it authenticates"
echo "against the real OpenAI API before relying on it."

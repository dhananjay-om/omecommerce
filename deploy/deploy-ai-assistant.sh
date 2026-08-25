#!/usr/bin/env bash
# Deploys AI Assistant: a real chat page (AI > AI Assistant) that answers
# questions about the store in plain language, backed by OpenAI function-
# calling against the same read-only analytics API the Reports pages
# already use (/admin/v1/analytics/* — no new aggregation logic, just tool
# definitions wrapping it, see src/modules/ai/infrastructure/assistant-tools.ts).
# Every tool is read-only, so there's no destructive-action risk from the
# model calling one.
#
# Uses whatever OpenAI key is already configured in AI Settings (Stores >
# AI Settings) — if you haven't saved and tested a real key there yet, do
# that first; without one, the assistant shows a clear "needs an OpenAI
# key" message instead of a crash, but obviously can't actually answer
# anything.
#
# No new database table, no new permission (reuses the existing `ai:view`
# permission Insights already uses — chatting is a viewing action, not
# AI-provider configuration). Chat history is NOT saved — it lives only in
# the browser tab, gone on refresh (a deliberate v1 scope decision).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-ai-assistant.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new POST /admin/v1/ai/assistant/chat endpoint + the tool-calling loop)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (real /ai/assistant chat page; the topbar 'Ask AI' button now opens it too)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission or migration — nothing else to configure."
echo "    Go to AI > AI Assistant (or click 'Ask AI' in the topbar) and try a real question."

#!/usr/bin/env bash
# Automation: "Send Test" button for webhook actions.
#
# Until now the only way to check a webhook was to wait for a real
# trigger event and look at "View recent runs" afterward — no way to
# check reachability while composing a rule. This adds a real "Send
# Test" button next to every webhook action's URL field (in both
# Automation > Workflows and Automation > Rules' rule form) that fires a
# real sample payload at the URL right now, through the exact same send
# path a live rule match uses, and shows a real ✓/✗ result inline —
# works even before the rule is saved.
#
# No migration, no new permission — reuses automation:manage (the same
# gate creating/editing rules already uses). Just a rebuild of api +
# admin.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-automation-webhook-test.sh
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

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no permission sync needed."
echo
echo "Try it: Automation > Workflows (or Rules) > New Workflow (or Edit an"
echo "existing one) > add/open a 'Call a webhook' action > 'Send Test'."

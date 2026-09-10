#!/usr/bin/env bash
# Diagnostic only — makes no changes. "Send Test" works (a direct call),
# but a real order doesn't trigger the webhook — this checks each real
# step of the actual pipeline (order -> outbox event -> relay -> worker
# -> rule evaluation -> webhook) to find exactly where it stops, instead
# of guessing.
#
# Run from the repo root, after `git pull`: ./deploy/diagnose-automation-webhook-not-firing.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
PSQL='psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "==================================================================="
echo "1) Is the api container actually running the automation-rules worker?"
echo "==================================================================="
$COMPOSE exec -T api sh -c '
  for f in dist/src/workers/automation-rules.worker.js dist/src/modules/automation/application/evaluate-automation-rules.usecase.js; do
    if [ -f "$f" ]; then echo "PRESENT: $f"; else echo "MISSING: $f  <-- stale image, needs rebuild"; fi
  done
' 2>&1

echo
echo "==================================================================="
echo "2) The real rule(s) — trigger, active state, and its actions, straight from the DB"
echo "==================================================================="
$COMPOSE exec -T postgres sh -c "$PSQL -c \"select public_id, name, trigger_type, is_active, actions from automation_rule order by created_at desc;\"" 2>&1

echo
echo "==================================================================="
echo "3) The 5 most recently placed orders"
echo "==================================================================="
$COMPOSE exec -T postgres sh -c "$PSQL -c \"select public_id, order_number, email, placed_at from \\\"order\\\" order by placed_at desc limit 5;\"" 2>&1

echo
echo "==================================================================="
echo "4) Recent OrderPlaced outbox events — were they written, and relayed?"
echo "   (published_at IS NULL means the relay hasn't picked it up yet —"
echo "   should never stay null for more than a couple seconds)"
echo "==================================================================="
$COMPOSE exec -T postgres sh -c "$PSQL -c \"select id, aggregate_id, published_at, created_at from outbox_event where event_type = 'OrderPlaced' order by id desc limit 5;\"" 2>&1

echo
echo "==================================================================="
echo "5) Recent automation rule evaluations — did the engine even run for these orders?"
echo "   (zero rows here means the event never reached EvaluateAutomationRules"
echo "   at all — the real thing to explain; a row with matched=false or a"
echo "   failed webhook action means it ran but something else went wrong)"
echo "==================================================================="
$COMPOSE exec -T postgres sh -c "$PSQL -c \"select id, rule_id, triggered_at, matched, entity_type, entity_public_id, action_results from automation_rule_run order by id desc limit 10;\"" 2>&1

echo
echo "==================================================================="
echo "6) Recent api logs mentioning 'automation' or 'webhook'"
echo "==================================================================="
$COMPOSE logs --tail=500 api 2>&1 | grep -i "automation\|webhook" || echo "(nothing matched)"

echo
echo "==> Copy everything above this line back into the chat."

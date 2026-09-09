#!/usr/bin/env bash
# Automation: Rules + Workflows (Phase 2 of 2 — Scheduled Jobs shipped
# earlier as Phase 1).
#
# A real WHEN/IF/THEN automation engine — form-based (dropdowns/forms,
# same UI conventions as every other admin page), not a drag-and-drop
# visual canvas (confirmed with the user). One engine powers both admin
# surfaces: Rules is a fast single-condition/single-action quick-create,
# Workflows is the full multi-condition/multi-action builder — a rule
# created via the quick form is just a minimal workflow, not two
# separate systems.
#
#   - WHEN: 8 real triggers, each a real outbox event already flowing
#     through this app (order placed/paid/cancelled/refunded/shipped/
#     closed, stock changed, customer registered) — nothing new had to
#     start emitting events for this to work.
#   - IF: plain field/comparator/value conditions against that event's
#     real, freshly-resolved entity (an order re-fetched fresh, or —
#     for stock/customer — straight from the event's own real payload).
#     All conditions AND together; zero conditions always matches.
#   - THEN: 3 real actions — send an email, call a webhook, or add an
#     internal order note (order-scoped triggers only) — each backed by
#     something that already existed or a small, generic new primitive
#     (the webhook call), not a fabricated action per example.
#
# Deliberately NOT built (disclosed, not silently skipped): "auto-reorder
# on low stock" from the nav's own original example copy needs Purchase
# Orders, a separate not-yet-built feature; "delayed-shipment escalation"
# needs a new periodic scan (no such event exists today). "High-value
# order approval" IS realized, via notify + flag an internal note, not a
# new order-hold status.
#
# No new permissions this phase (automation:view/automation:manage were
# already added in Phase 1 — reused here, nothing new to sync).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-automation-rules-workflows.sh
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

echo "==> Applying the new automation_rule / automation_rule_run tables"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Automation > Workflows / Rules)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission needed — if you already ran"
echo "deploy-automation-scheduled-jobs.sh's Sync Permissions step, you're"
echo "already set. Otherwise do that once (Stores > Admin Permissions >"
echo "Sync Permissions, then log out and back in) before using this."
echo
echo "Try it: Automation > Workflows > New Workflow — pick a trigger (e.g."
echo "'Order placed'), add a condition, add a 'Send an email' or 'Call a"
echo "webhook' action, save it active, then place a real order that"
echo "matches it and check its 'View recent runs' a few seconds later."

#!/usr/bin/env bash
# System: Audit Logs (Phase 4 of 4 — completes the group).
#
# A real, generic audit trail — deliberately scoped to the security-
# sensitive System area this whole 4-part feature built (admin users,
# roles & permissions), not a blanket automatic before/after-diff
# middleware across every write path in the app. That's a much larger,
# riskier retrofit; this is the concrete starting point, with an obvious
# extension point (AuditLogRepository.record()) for wiring in more
# modules later.
#
# Every mutation from Phase 1 (Users) and Phase 2 (Roles & Permissions)
# now records a real entry: who did it, what action, on what entity, a
# plain-English summary. New System > Audit Logs page (filterable by
# Users/Roles/System). No new permission — gated by the same
# admin:manage that already protects the actions it logs.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-system-audit-logs.sh
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

echo "==> Applying the new audit_log table"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (System > Audit Logs)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync."
echo
echo "Try it: create or edit a user/role under System > Users or System >"
echo "Roles & Permissions, then check System > Audit Logs — the action"
echo "should show up immediately with your email as the actor."
echo
echo "==> This completes the entire System group: Users, Roles &"
echo "Permissions, Notifications (+ the real topbar bell), and Audit Logs"
echo "are all now real and live."

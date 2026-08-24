#!/usr/bin/env bash
# Deploys admin UI revamp Phase 0/1: the new always-visible sidebar/topbar
# shell, the full "Meridian Commerce OS" mock nav (34 items, 8 groups, all
# real backend-backed items restyled to the new tokens, all not-yet-built
# items as honest "Coming Soon" placeholders — zero dead links). Admin app
# only, no backend/migration changes.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-admin-ui-revamp-phase0.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin (new shell, nav, and 24 placeholder pages)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. The admin sidebar is now an always-visible list"
echo "    instead of the old icon rail — every admin using it daily should"
echo "    expect that change. A theme toggle (sun/moon icon, top right) and"
echo "    a command palette (search bar, or Ctrl/Cmd+K) are both new."
echo "    Sections without a Coming Soon badge already work exactly as"
echo "    before; sections marked 'Soon' link to a real page explaining"
echo "    what's planned there, not a broken link."

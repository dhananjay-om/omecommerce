#!/usr/bin/env bash
# Deploys the floating/persistent Save button on the 10 longest admin
# forms (product edit especially). Admin-only, no migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-floating-save-button.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."

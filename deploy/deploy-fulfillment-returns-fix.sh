#!/usr/bin/env bash
# Hotfix for the Fulfillment > Returns "Something went wrong" bug (and the
# same latent issue in Pick & Pack's bin location field) — a 'use server'
# file exported a plain object, which this Next.js build rejects and which
# crashed the whole page's render. Admin-only fix, no migration, no
# permission change — just rebuilds the admin container.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-fulfillment-returns-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding admin"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Open Fulfillment > Returns and try Approve again."

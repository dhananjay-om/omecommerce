#!/usr/bin/env bash
# Deploys the "edit existing attribute options" feature.
#
# Options were create-time-only — once an attribute existed, there was no
# way to fix a typo'd value/label or add another option without deleting
# and recreating the whole attribute (which would also orphan its
# attribute-set assignments). The Edit Attribute dialog now fetches the
# attribute's real existing options on open and pre-fills them as editable
# rows, alongside the existing "Add Option" flow for brand new ones.
#
# New PUT /admin/v1/attributes/:code/options route — reuses the existing
# catalog:manage permission, no new permission to sync. No schema change,
# no migration.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-attribute-options-editing.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new PUT /admin/v1/attributes/:code/options route)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (Edit Attribute dialog now shows/edits existing options)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no new permission to sync."
echo
echo "To try it: Attributes > edit any SELECT/MULTISELECT attribute (like"
echo "your variant_color/variant_size ones) — its existing options now"
echo "load pre-filled and editable, with Add Option still there for new ones."

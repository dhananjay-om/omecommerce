#!/usr/bin/env bash
# Fixes the storefront header logo looking small/dull — it was hardcoded
# to a fixed 40px height regardless of the actual uploaded logo, while
# the footer's own logo already rendered at 48px. Now both use the same
# 48px cap, and the header logo renders at its natural size up to that
# cap instead of always being forced down to 40px.
#
# Storefront only — no migration, no permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-header-logo-size-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding storefront"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. Reload the storefront — if a logo is configured"
echo "(Stores > General Settings), it should now show larger/clearer in"
echo "the header, matching the footer's own size."

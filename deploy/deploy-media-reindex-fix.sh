#!/usr/bin/env bash
# Deploys the fix for stale product images on the homepage/PLP/search
# (e.g. "Elegant Blue Ethnic Dress" showing a random stock photo instead
# of its real uploaded photos, even though the PDP itself showed them
# correctly).
#
# Root cause: a product is always created before its photos are uploaded.
# The search index only ever got written once, at creation, when the
# product had zero media — uploading real photos afterward never told
# search to update. AttachProductMedia/DetachProductMedia/
# SetProductThumbnail now fire a reindex trigger, so this won't happen to
# any product going forward.
#
# That only fixes FUTURE media changes — this script also runs a one-time
# full reindex so every product already affected (like the dress) gets
# fixed today too.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-media-reindex-fix.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (media changes now trigger a search reindex)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Fixing every product affected by this until now — running a"
echo "    one-time full reindex (this is the same as running"
echo "    deploy/reindex-search.sh separately):"
echo
"$REPO_ROOT/deploy/reindex-search.sh"

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Check 'Elegant Blue Ethnic Dress' on the homepage now — it should"
echo "show its real photo. Any future product's photos will show up"
echo "correctly without ever needing another manual reindex."

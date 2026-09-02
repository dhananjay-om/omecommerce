#!/usr/bin/env bash
# Diagnoses the reported "PDP page crashed, image not showing" issue.
#
# I could NOT reproduce this locally — I ran the actual production build
# (next build + the standalone server, not next dev) against real backend
# data and the product page rendered correctly, image and all. So this
# script gathers the specific facts I can't see from here: which commit is
# actually running, what the server itself is logging, what a real request
# to a product page actually returns, and whether the container can reach
# the image CDN. Uses `node -e`/`node -` for the in-container HTTP checks
# (not curl/wget) since the storefront's node:24-slim runtime image isn't
# guaranteed to have either installed, but node itself obviously is.
#
# You do NOT need to know a real product slug/URL yourself — if you don't
# pass one, this script fetches your own homepage and auto-discovers a real
# product link from it, the same way the last two runs' default
# "coffee-maker" guess (wrong — that only exists in local dev data, not
# your production catalog) kept giving a useless 404.
#
# Run from the repo root on the PRODUCTION server:
#   ./deploy/diagnose-pdp-crash.sh            # auto-discovers a real product
#   ./deploy/diagnose-pdp-crash.sh some-slug  # or pass one yourself
#
# Paste the full output back — that's what will actually pin this down.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
SLUG="${1:-}"

FETCH_STATUS='node -e "fetch(process.argv[1]).then(r => console.log(\"STATUS\", r.status)).catch(e => console.log(\"FETCH FAILED:\", e.message))" "$1"'
FETCH_BODY='node -e "fetch(process.argv[1]).then(r => r.text()).then(t => console.log(t.slice(0, 2000))).catch(e => console.log(\"FETCH FAILED:\", e.message))" "$1"'

echo "========================================================"
echo "1) Which commit is actually deployed on disk right now"
echo "========================================================"
git log -1 --format='%H %ci %s'
git status --short | head -20
echo

echo "========================================================"
echo "2) Container status"
echo "========================================================"
$COMPOSE ps storefront api
echo

echo "========================================================"
echo "3) Recent storefront container logs (last 150 lines)"
echo "   — a server-side crash/stack trace will show up here"
echo "========================================================"
$COMPOSE logs --tail 150 storefront
echo

echo "========================================================"
echo "4) Finding a real product to test"
echo "========================================================"
if [ -n "$SLUG" ]; then
  echo "Using the slug you passed: $SLUG"
else
  echo "No slug passed — auto-discovering a real product from your own homepage..."
  DISCOVERED_SLUG="$($COMPOSE exec -T storefront node - <<'NODEEOF'
fetch('http://localhost:3001/')
  .then((r) => r.text())
  .then((html) => {
    const matches = [...html.matchAll(/href="\/([a-z0-9][a-z0-9-]*)\.html"/g)];
    const slug = matches.map((m) => m[1]).find((s) => s !== 'index');
    process.stdout.write(slug || '');
  })
  .catch(() => process.stdout.write(''));
NODEEOF
  )"
  if [ -n "$DISCOVERED_SLUG" ]; then
    SLUG="$DISCOVERED_SLUG"
    echo "Auto-discovered a real product from the homepage: $SLUG"
  else
    SLUG="coffee-maker"
    echo "Could not auto-discover a product from the homepage (it may itself be broken/empty)."
    echo "Falling back to '$SLUG' — this is likely WRONG for your production catalog, treat a 404 below as inconclusive."
  fi
fi
echo

echo "========================================================"
echo "5) Real HTTP request to that real product page, from"
echo "   inside the storefront container itself"
echo "========================================================"
echo "--- status ---"
$COMPOSE exec -T storefront sh -c "$FETCH_STATUS" sh "http://localhost:3001/${SLUG}.html"
echo "--- first 2000 chars of the response body ---"
$COMPOSE exec -T storefront sh -c "$FETCH_BODY" sh "http://localhost:3001/${SLUG}.html"
echo

echo "========================================================"
echo "6) Can the storefront container reach the image CDN?"
echo "   (images.unsplash.com — used for this store's own"
echo "   seed/demo products, not real admin-uploaded photos)"
echo "========================================================"
$COMPOSE exec -T storefront sh -c "$FETCH_STATUS" sh "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085"
echo

echo "========================================================"
echo "7) Can the storefront reach the backend API"
echo "========================================================"
$COMPOSE exec -T storefront sh -c "$FETCH_STATUS" sh "http://api:3000/health"
echo

echo "========================================================"
echo "Done. Paste this whole output back — sections 1, 3, 5, and"
echo "6 are the ones most likely to show what's actually wrong."
echo "========================================================"

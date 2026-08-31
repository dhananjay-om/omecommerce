#!/usr/bin/env bash
# Diagnoses the reported "PDP page crashed, image not showing" issue.
#
# I could NOT reproduce this locally — I ran the actual production build
# (next build + the standalone server, not next dev) against real backend
# data and the product page rendered correctly, image and all. So this
# script gathers the specific facts I can't see from here: which commit is
# actually running, what the server itself is logging, what a real request
# to a product page actually returns, and whether the container can reach
# the image CDN. Uses `node -e` for the in-container HTTP checks (not curl/
# wget) since the storefront's node:24-slim runtime image isn't guaranteed
# to have either installed, but node itself obviously is.
#
# Run from the repo root on the PRODUCTION server:
#   ./deploy/diagnose-pdp-crash.sh [product-slug]
#
# Paste the full output back — that's what will actually pin this down.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
SLUG="${1:-coffee-maker}"

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
echo "4) Real HTTP request to a real product page, from inside"
echo "   the storefront container itself"
echo "========================================================"
echo "--- status ---"
$COMPOSE exec -T storefront sh -c "$FETCH_STATUS" sh "http://localhost:3001/${SLUG}.html"
echo "--- first 2000 chars of the response body ---"
$COMPOSE exec -T storefront sh -c "$FETCH_BODY" sh "http://localhost:3001/${SLUG}.html"
echo

echo "========================================================"
echo "5) Can the storefront container reach the image CDN?"
echo "   (images.unsplash.com — used for this store's own"
echo "   seed/demo products, not real admin-uploaded photos)"
echo "========================================================"
$COMPOSE exec -T storefront sh -c "$FETCH_STATUS" sh "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085"
echo

echo "========================================================"
echo "6) Can the storefront reach the backend API"
echo "========================================================"
$COMPOSE exec -T storefront sh -c "$FETCH_STATUS" sh "http://api:3000/health"
echo

echo "========================================================"
echo "Done. Paste this whole output back — sections 1, 3, 4, and"
echo "5 are the ones most likely to show what's actually wrong."
echo "========================================================"

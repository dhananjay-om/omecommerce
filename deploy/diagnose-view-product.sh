#!/usr/bin/env bash
# Ad-hoc diagnostic for "View Product" 404ing from the admin product page.
# Run from the repo root: git pull && ./deploy/diagnose-view-product.sh
# Then copy the WHOLE output back.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
PRODUCT_ID="01a01e26-3bd4-706f-97b8-044d8ef8870c"

# Pull POSTGRES_USER/POSTGRES_DB out of .env.production so we can talk to
# psql directly, without going through any authenticated HTTP endpoint.
set -a
# shellcheck disable=SC1091
source .env.production
set +a

echo "=================================================================="
echo "0. Container status/age"
echo "=================================================================="
$COMPOSE ps

echo
echo "=================================================================="
echo "1. This product's ACTUAL slug, straight from Postgres (bypasses"
echo "   auth entirely — no admin token needed for this check)"
echo "=================================================================="
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT sku, name_default, slug, deleted_at FROM product WHERE public_id = '${PRODUCT_ID}'"

echo
echo "=================================================================="
echo "1b. How many products still have a NULL/empty slug (should be 0)"
echo "=================================================================="
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT count(*) AS null_or_empty_slug_count FROM product WHERE slug IS NULL OR slug = ''"

echo
echo "=================================================================="
echo "2. Storefront's PDP route for that exact slug (verbose)"
echo "=================================================================="
SLUG=$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A \
  -c "SELECT slug FROM product WHERE public_id = '${PRODUCT_ID}'" | tr -d '[:space:]')
echo "Resolved slug: '${SLUG}'"
if [ -n "$SLUG" ]; then
  curl -v "https://omecom.vcto.in/${SLUG}.html" 2>&1 | tail -40
else
  echo "!! slug is empty/null — that's the bug right there, see step 1 above"
fi

echo
echo "=================================================================="
echo "2b. Same request, straight to the api container internally, using"
echo "    storeViewId=1 (node has no curl, using its built-in fetch) —"
echo "    isolates whether the api itself is fine when asked directly"
echo "=================================================================="
$COMPOSE exec -T api node -e "
  fetch('http://localhost:3000/store/v1/products/by-slug/${SLUG}?storeViewId=1')
    .then(async (r) => { console.log('status:', r.status); console.log(await r.text()); })
    .catch((e) => console.error('fetch failed:', e.message));
"

echo
echo "=================================================================="
echo "2c. The storefront container's ACTUAL env vars for this — if"
echo "    STORE_VIEW_ID here isn't '1', that's very likely the bug"
echo "=================================================================="
$COMPOSE exec -T storefront sh -c 'echo "API_BASE_URL=$API_BASE_URL"; echo "WEBSITE_CODE=$WEBSITE_CODE"; echo "STORE_VIEW_ID=$STORE_VIEW_ID"'

echo
echo "=================================================================="
echo "2d. THE EXACT SAME CALL the storefront's own code makes — run FROM"
echo "    INSIDE the storefront container, using ITS real API_BASE_URL"
echo "    and STORE_VIEW_ID (not hardcoded) — this should reproduce the"
echo "    failure if it's env/container-specific"
echo "=================================================================="
$COMPOSE exec -T storefront sh -c "
  node -e \"
    const base = process.env.API_BASE_URL;
    const sv = process.env.STORE_VIEW_ID || '1';
    const url = base + '/store/v1/products/by-slug/${SLUG}?storeViewId=' + sv;
    console.log('Requesting:', url);
    fetch(url)
      .then(async (r) => { console.log('status:', r.status); console.log(await r.text()); })
      .catch((e) => console.error('fetch failed:', e.message));
  \"
"

echo
echo "=================================================================="
echo "3. storefront container logs, filtered to just errors (last 200"
echo "   raw lines, grepped down)"
echo "=================================================================="
$COMPOSE logs storefront --tail 200 | grep -iE "error|fail|slug" || echo "(no matching lines)"

echo
echo "=================================================================="
echo "4. api container logs, filtered to just by-slug requests and errors"
echo "   (last 300 raw lines, grepped down — /health noise excluded)"
echo "=================================================================="
$COMPOSE logs api --tail 300 | grep -iE "by-slug|error|prisma" || echo "(no matching lines)"

echo
echo "=================================================================="
echo "Done. Copy this WHOLE output back."
echo "=================================================================="

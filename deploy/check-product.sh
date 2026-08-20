#!/usr/bin/env bash
# Checks what the storefront search API actually returns for one product —
# price, currency, and image URL — straight from inside the api container,
# bypassing the browser/CDN entirely. Useful for telling apart "no price
# resolves" vs "no image resolves" vs "both are actually fine and it's a
# frontend/caching problem".
#
# Run from the repo root:
#   git pull && ./deploy/check-product.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

read -rp "SKU or search term [OMCO11]: " TERM
TERM="${TERM:-OMCO11}"
read -rp "Store view id [1]: " SV
SV="${SV:-1}"

$COMPOSE exec \
  -e SEARCH_TERM="$TERM" \
  -e STORE_VIEW_ID="$SV" \
  api node -e '
const term = encodeURIComponent(process.env.SEARCH_TERM);
const sv = encodeURIComponent(process.env.STORE_VIEW_ID);
fetch("http://localhost:3000/store/v1/search?storeViewId=" + sv + "&q=" + term)
  .then((r) => r.json())
  .then((d) => console.log(JSON.stringify(d, null, 2)))
  .catch((e) => console.error(e));
'

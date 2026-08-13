#!/usr/bin/env bash
# Triggers a full search reindex — needed once after a fresh database (the
# OpenSearch product_search index is created lazily on first write, so
# until something indexes into it, storefront pages that query search
# (featured/best-selling products, category/PLP pages, etc.) 500 with
# index_not_found_exception even though everything else is healthy).
#
# Logs in as the seeded dev admin (see DEPLOYMENT.md §7 — change that
# account's password separately; this script just needs A valid admin
# token to call the endpoint, same pattern as that section) and calls
# POST /admin/v1/search/reindex, all from inside the api container against
# its own localhost — same reasoning as DEPLOYMENT.md's "Why the API isn't
# public".
#
# Run from the repo root: ./deploy/reindex-search.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

docker compose -f docker-compose.prod.yml --env-file .env.production exec api node -e "
fetch('http://localhost:3000/admin/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@ome.local', password: 'dev-only-password-change-me' }),
}).then(r => r.json()).then(({ data }) =>
  fetch('http://localhost:3000/admin/v1/search/reindex', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + data.token },
  })
).then(r => r.json()).then(result => {
  console.log(JSON.stringify(result, null, 2));
});
"

#!/usr/bin/env bash
# Triggers a full search reindex — needed once after a fresh database (the
# OpenSearch product_search index is created lazily on first write, so
# until something indexes into it, storefront pages that query search
# (featured/best-selling products, category/PLP pages, etc.) 500 with
# index_not_found_exception even though everything else is healthy). Also
# the fix for a product whose search document is stale — e.g. an image or
# price set after the last index write — since a full reindex recomputes
# every field (price, image, facets) fresh from the current database.
#
# Prompts for a real admin login rather than the seeded dev account (see
# DEPLOYMENT.md §7 — you were told to lock that one down already, so this
# doesn't assume it still works) and calls POST /admin/v1/search/reindex,
# all from inside the api container against its own localhost — same
# reasoning as DEPLOYMENT.md's "Why the API isn't public".
#
# Run from the repo root: ./deploy/reindex-search.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

read -rp "Admin email: " ADMIN_EMAIL
read -rsp "Admin password: " ADMIN_PASSWORD
echo

$COMPOSE exec \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  api node -e '
fetch("http://localhost:3000/admin/v1/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
}).then((r) => r.json()).then(({ data }) => {
  if (!data || !data.token) throw new Error("login failed — check your email/password");
  return fetch("http://localhost:3000/admin/v1/search/reindex", {
    method: "POST",
    headers: { Authorization: "Bearer " + data.token },
  });
}).then((r) => r.json()).then((result) => {
  console.log(JSON.stringify(result, null, 2));
}).catch((err) => { console.error(err.message); process.exit(1); });
'

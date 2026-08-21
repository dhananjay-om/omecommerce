#!/usr/bin/env bash
# Deploys SEO-friendly product URLs: /{product-name}.html instead of
# /products/{id}. Rebuilds api/admin/storefront and applies the new
# product_slug migration, which auto-generates a slug for every EXISTING
# product from its name (falling back to its SKU) — nothing to configure,
# every product gets a working new URL immediately. The old /products/{id}
# links keep working too (they now permanently redirect to the new URL),
# so nothing already shared/bookmarked/indexed breaks.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-product-slug-urls.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api, admin, storefront"
$COMPOSE up -d --build api admin storefront
if [ $? -ne 0 ]; then
  echo "!! build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying database migrations"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. Every existing product now has a working"
echo "    /{name}.html URL (check a product's edit page — Basic Information"
echo "    > URL Slug — to see what it got). New products get one"
echo "    automatically the moment they're created."
echo
read -rp "Also run a full search reindex now, so search results/PLP cards link to the new URLs right away? [y/N] " REPLY
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  read -rp "Admin email: " ADMIN_EMAIL
  read -rsp "Admin password: " ADMIN_PASSWORD
  echo
  $COMPOSE exec \
    -e ADMIN_EMAIL="$ADMIN_EMAIL" \
    -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    api node -e '
      const email = process.env.ADMIN_EMAIL;
      const password = process.env.ADMIN_PASSWORD;
      fetch("http://localhost:4100/admin/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
        .then((r) => r.json())
        .then((body) => {
          const token = body?.data?.token;
          if (!token) throw new Error("login failed: " + JSON.stringify(body));
          return fetch("http://localhost:4100/admin/v1/search/reindex", {
            method: "POST",
            headers: { authorization: "Bearer " + token },
          });
        })
        .then((r) => r.json())
        .then((body) => console.log("reindex result:", JSON.stringify(body)))
        .catch((err) => {
          console.error(err.message);
          process.exit(1);
        });
    '
  echo "==> Reindex done."
else
  echo "==> Skipped — search results still show the old /products/{id} link until the next natural reindex (still works, just an extra redirect hop)."
fi

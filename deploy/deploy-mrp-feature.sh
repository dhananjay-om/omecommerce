#!/usr/bin/env bash
# Deploys the MRP / compare-at price feature: rebuilds api+admin+storefront
# with the new code, applies the new migration (product_price.mrp +
# order_line.mrp), then offers a full search reindex so existing products'
# search results/PLP cards pick up mrpDisplay immediately instead of waiting
# for the next natural reindex (a stale search doc just shows no strikethrough
# until then — not a breakage, but this closes the gap in one step).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-mrp-feature.sh
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
echo "==> Deploy complete. MRP is now settable from the admin Pricing page"
echo "    and the product edit page's Pricing & Inventory section."
echo
read -rp "Also run a full search reindex now, so existing products show their MRP/discount badge on search results right away? [y/N] " REPLY
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
  echo "==> Skipped — new/updated products will index with MRP the next time they're saved or reindexed normally."
fi

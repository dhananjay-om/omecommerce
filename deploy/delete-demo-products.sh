#!/usr/bin/env bash
# Deletes the standard demo/seed catalog products (from `npm run db:seed`
# and scripts/seed-demo-data.mjs) through the real admin API — same effect
# as clicking Delete in the admin UI for each one, including zeroing stock
# first (DeleteProduct rejects a product that still has stock anywhere).
#
# Run from the repo root:
#   git pull && ./deploy/delete-demo-products.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

read -rp "Admin email: " ADMIN_EMAIL
read -rsp "Admin password: " ADMIN_PASSWORD
echo

$COMPOSE exec \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  api node -e '
const BASE = "http://localhost:3000";
const DEMO_SKUS = [
  "SKU-1",
  "DEMO-LAPTOP-PRO-14",
  "DEMO-LAPTOP-AIR-13",
  "DEMO-PHONE-X1",
  "DEMO-PHONE-LITE",
  "DEMO-EARBUDS",
  "DEMO-MENS-JACKET",
  "DEMO-WOMENS-SNEAKERS",
  "DEMO-TSHIRT",
  "DEMO-COFFEE-MAKER",
];

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(method + " " + path + " -> " + res.status + ": " + text);
  return data;
}

(async () => {
  const login = await api("POST", "/admin/v1/auth/login", null, {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  const token = login.data.token;

  for (const sku of DEMO_SKUS) {
    const list = await api("GET", "/admin/v1/products?search=" + encodeURIComponent(sku) + "&pageSize=5", token);
    const match = list.data.products.find((p) => p.sku === sku);
    if (!match) {
      console.log("SKIP  " + sku + " — not found (already deleted?)");
      continue;
    }
    const detail = await api("GET", "/admin/v1/products/" + match.publicId, token);
    for (const variant of detail.data.variants) {
      const stock = await api("GET", "/admin/v1/variants/" + variant.publicId + "/stock", token);
      for (const row of stock.data) {
        if (row.onHand > 0) {
          await api("POST", "/admin/v1/inventory/adjustments", token, {
            variantId: variant.publicId,
            warehouseCode: row.warehouseCode,
            delta: -row.onHand,
            reason: "CORRECTION",
            note: "zeroing stock to delete demo product",
          });
        }
      }
    }
    await api("DELETE", "/admin/v1/products/" + match.publicId, token);
    console.log("DELETED " + sku + " (" + match.publicId + ")");
  }
  console.log("Done.");
})().catch((err) => { console.error(err.message); process.exit(1); });
'

echo
echo "Done. Reload the storefront — the home page carousels should now show"
echo "only your real product(s)."

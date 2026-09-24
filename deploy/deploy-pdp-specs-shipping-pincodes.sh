#!/usr/bin/env bash
# Product page: Specifications, Shipping & Returns text, and the Pincodes menu.
#
# 1) Specifications tab — now shows each attribute's real label and a proper value.
#    Before, a dropdown attribute (e.g. Fabric, Color) could show an internal number
#    instead of "Cotton", and labels were guessed from codes ("Ram" instead of "RAM").
#    Which attributes appear is controlled per attribute: Admin > Attributes > edit
#    (or New) > tick/untick "Show on product page (Specifications)". Description,
#    short description and SEO fields never appear here. The order follows the
#    product's attribute set.
#
# 2) Shipping & Returns tab — its text now comes from a content block you can edit:
#    Admin > Content > Blocks > "pdp_shipping_returns" (created for you, published,
#    with the text the tab showed before). Edit it with the normal block editor (bold,
#    lists, links). Set it to Draft (or delete it) to fall back to the built-in text.
#    It's one block for all products; a store-view-specific block with the same code
#    overrides it for that store.
#
# 3) "Check Delivery" pincodes — the admin page already existed at Stores > Pincodes but
#    was easy to miss; it's now in the Fulfillment menu as "Delivery Pincodes" (add
#    pincodes one by one or paste a CSV with "Bulk Add").
#
# Two migrations' worth of change: one data migration (creates the block, never
# overwrites an existing one). No new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-pdp-specs-shipping-pincodes.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (specifications on the product API)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Creating the pdp_shipping_returns content block"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (attribute setting + Delivery Pincodes menu)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (Specifications + Shipping & Returns tabs)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Edit the Shipping & Returns text in Admin > Content > Blocks > pdp_shipping_returns,"
echo "and manage delivery pincodes in Admin > Fulfillment > Delivery Pincodes."

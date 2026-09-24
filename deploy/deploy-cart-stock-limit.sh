#!/usr/bin/env bash
# Stop shoppers from putting more of an item in the cart than is in stock.
#
# Before: you could add or "+" past the available stock and only find out at
# checkout. Now:
#   - Product page: the quantity stepper stops at the available stock and shows
#     "Only N in stock — you can't add more than N." straight away; the stock line
#     says "Only N left in stock" when 5 or fewer remain.
#   - Cart page: "+" past the stock shows the same message instantly, and if
#     stock dropped after the item was added, the row says so.
#   - Server: the cart itself refuses a quantity above the stock (so nobody can
#     bypass the page), with the same clear message.
# Stock is counted from the warehouse checkout takes stock from, so "available"
# here always matches what checkout will really reserve.
#
# No migration, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-cart-stock-limit.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (stock check on add-to-cart, available quantity on products and cart)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (quantity limits and messages)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. Try a product with little stock: press + past the stock on the"
echo "product page and on the cart page — you should get the message instantly."

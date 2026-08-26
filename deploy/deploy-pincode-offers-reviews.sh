#!/usr/bin/env bash
# Deploys 3 storefront-facing features shipped together:
#
#   1. Pincode Checker — a new admin-curated `serviceable_pincode` table
#      (Stores > Pincodes: add/edit/bulk-add), and a public PDP "Check
#      Delivery" widget (GET /store/v1/pincodes/:code/check). A pincode not
#      in the admin list reads as "not serviceable yet" — no guessing.
#   2. Offers section — a new PDP "Available Offers" card listing only
#      real, currently-active coupons that actually apply to the specific
#      product (reuses the existing Coupon/CouponCondition targeting the
#      cart-evaluation path already trusts). No fabricated bank/card offers.
#   3. Real review system — ProductReview gains `customer_id` + `is_approved`.
#      A logged-in storefront customer can now submit a review (always
#      starts pending); admins moderate (Approve/Reject) on the existing
#      product Reviews tab; only approved reviews show on the public PDP,
#      with a real star-breakdown and average.
#
# New migration (serviceable_pincode table + product_review columns/index).
# No new permission — pincode admin routes and review moderation both reuse
# the existing `catalog:manage` permission, so no Sync Permissions/relogin
# step is needed this time.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-pincode-offers-reviews.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new pincode module + review submission/moderation + offers route)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new serviceable_pincode + product_review migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Stores > Pincodes page, Reviews tab moderation actions)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (PDP pincode checker, offers section, real reviews)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync this time."
echo
echo "The Pincode checker shows every pincode as unserviceable until you add"
echo "some real ones: Stores > Pincodes (Add Pincode or Bulk Add)."
echo
echo "The Offers section only shows a product if a real active coupon"
echo "actually applies to it (Coupons admin, PRODUCT/CATEGORY/ATTRIBUTE"
echo "conditions or a plain CART-wide coupon) — nothing to configure beyond"
echo "having real coupons."
echo
echo "Reviews: a logged-in storefront customer can submit one from any PDP's"
echo "Reviews tab; it stays pending (not publicly visible) until approved"
echo "from that product's admin Reviews tab (Approve/Reject buttons)."

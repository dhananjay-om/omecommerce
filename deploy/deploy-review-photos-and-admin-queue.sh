#!/usr/bin/env bash
# Deploys 2 follow-ups to the review system shipped in
# deploy-pincode-offers-reviews.sh:
#
#   1. Admin Reviews menu — a new cross-product moderation queue
#      (Commerce > Reviews, GET /admin/v1/reviews) so approving/rejecting
#      no longer requires hunting down which product a review belongs to
#      first. The existing per-product Reviews tab still works too — both
#      moderate through the same shared action/route.
#   2. Review photos — a customer can now attach up to 5 photos to their
#      review (Amazon-style), uploaded direct-to-storage the same way
#      product/media images already are. ProductReview gains an
#      `image_keys` column; a new customer-gated
#      POST /store/v1/reviews/uploads mints the presigned upload URL.
#      Photos show as thumbnails in both the admin queue and the public
#      PDP review list.
#
# New migration (product_review.image_keys). No new permission — the new
# admin GET /admin/v1/reviews route reuses the existing `catalog:manage`
# permission, same as review moderation already does.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-review-photos-and-admin-queue.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (review photo upload/storage + cross-product admin reviews list)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new product_review.image_keys migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Commerce > Reviews queue, photo thumbnails on both review views)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (photo upload on the Write a Review form, thumbnails on approved reviews)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync this time."
echo
echo "Commerce > Reviews (new sidebar item) is the one-stop moderation queue —"
echo "filter by All/Pending/Approved, Approve/Reject right there, no need to"
echo "open each product individually anymore."

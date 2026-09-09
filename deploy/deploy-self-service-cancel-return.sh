#!/usr/bin/env bash
# Storefront self-service: Cancel Order + Request Return, both with a real
# choice of refund destination (original payment method or store credit
# wallet) — the feature this request asked for by name.
#
#   - Cancel Order (POST /store/v1/me/orders/:id/cancel, new): a logged-in
#     customer can now cancel their own order directly from its detail
#     page, same as the admin's own Cancel Order action — same real
#     guard too (only while nothing has shipped yet), just
#     ownership-checked so a customer can only ever touch their own
#     order (a plain 404 if they try someone else's, never a 403 that
#     would confirm the order exists). Refunds immediately, to whichever
#     destination they pick.
#   - Request Return (POST /store/v1/me/orders/:id/returns, new): a
#     customer can submit a return request for anything that's actually
#     shipped to them (a real new guard — you can't request a return for
#     something never fulfilled, closes a pre-existing gap the admin-only
#     version of this never checked either). This does NOT refund
#     anything by itself — it still goes through the exact same
#     admin-moderated Approve -> Receive -> Refund pipeline as an
#     admin-logged return always has (Fulfillment > Returns). The
#     customer's chosen refund destination is captured at request time
#     and honored automatically once an admin actually refunds it later
#     — nobody has to ask again.
#   - Admin: the Create Return dialog and the cross-order Returns list
#     both now show/set the refund destination too.
#
# One small schema change: OrderReturn.refundTo (nullable text, safe/
# additive — an older return with none set just falls back to the
# original payment method when refunded, exactly as before this
# existed). No new permission — every new route reuses an existing
# permission tier (requireCustomer for the two new storefront routes,
# same as every other self-service order route already uses).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-self-service-cancel-return.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new order_return.refund_to column"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Create Return dialog + Returns list now show refund destination)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding storefront (Cancel Order + Request Return on the order detail page)"
$COMPOSE up -d --build storefront
if [ $? -ne 0 ]; then
  echo "!! storefront build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Done. No new permission, nothing else to configure."
echo "On a logged-in customer's own order page: 'Cancel Order' shows while"
echo "nothing has shipped yet; 'Request Return' shows once something has."
echo "Existing return requests still need approving in Fulfillment > Returns"
echo "exactly as before — this doesn't change who approves/refunds them,"
echo "only who can start one."

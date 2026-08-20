#!/usr/bin/env bash
# Deploys everything currently on main that hasn't been rolled out yet:
#   - MRP / compare-at price (admin Pricing + product edit, storefront PLP/
#     PDP/cart, order lines)
#   - Real order transactional email (confirmation/shipment/cancellation/
#     refund), automatic on order events
#   - The admin "Stores > Email (SMTP)" settings page + "Send Test Email"
#
# One script instead of running deploy-mrp-feature.sh, deploy-smtp-settings-
# page.sh, etc. one at a time — rebuilds every service and applies every
# pending migration in one pass (safe to re-run; a migration already applied
# is just skipped).
#
# Run from the repo root, after `git pull`: ./deploy/deploy-latest.sh
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
echo "==> Deploy complete. What to do next:"
echo "    1. Set up email: log into the admin, go to Stores > Email (SMTP),"
echo "       enter your Gmail/Google Workspace address + an App Password"
echo "       (https://myaccount.google.com/apppasswords), Save, then click"
echo "       'Send Test Email' to confirm it works. Until this is set, order"
echo "       emails are only logged, never actually sent."
echo "    2. Set an MRP on any product you want to show a strikethrough/"
echo "       discount badge for: Pricing page (or a product's edit page) >"
echo "       Set Price > fill in the MRP field alongside Price."
echo
read -rp "Also run a full search reindex now, so existing products with an MRP show their discount badge on search results right away? [y/N] " REPLY
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
  echo "==> Skipped — products reindex automatically as they're edited normally."
fi

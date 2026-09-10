#!/usr/bin/env bash
# Fixes "I placed an order but got no notification."
#
# By design, the notification bell does NOT fire automatically on a new
# order — the only two things that create a notification are (1) an
# Alert Rule's threshold firing (nightly, metric-based) and (2) an
# Automation Rule you've configured with a "Notify admins" action. No
# rule ever gets created for you automatically, so an order placed
# before you set one up correctly produced nothing.
#
# This creates that rule for you — WHEN Order placed, THEN Notify
# admins — through the real admin API, the same one Automation >
# Workflows itself calls. Safe to re-run: it checks for an existing rule
# with this exact name first and skips creating a duplicate.
#
# Run from the repo root, after `git pull` and after re-deploying (this
# script also benefits from deploy/deploy-system-notifications.sh's
# richer default notification text — order amount/status — so run that
# rebuild first if you haven't already):
#   ./deploy/seed-order-notification-rule.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (picks up the richer default notification text —"
echo "    order amount/status instead of a bare label)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

read -rp "Admin email: " ADMIN_EMAIL
read -rsp "Admin password: " ADMIN_PASSWORD
echo

$COMPOSE exec \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  api node -e '
const BASE = "http://localhost:3000";
const RULE_NAME = "Notify admins on new order";

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

  const existing = await api("GET", "/admin/v1/automation/rules", token);
  const already = existing.data.find((r) => r.name === RULE_NAME);
  if (already) {
    console.log("SKIP — a rule named \"" + RULE_NAME + "\" already exists (" + already.publicId + "). Nothing to do.");
    if (!already.isActive) {
      console.log("NOTE — that rule is currently INACTIVE, so it still won'\''t fire. Activate it from Automation > Workflows.");
    }
    return;
  }

  const created = await api("POST", "/admin/v1/automation/rules", token, {
    name: RULE_NAME,
    triggerType: "ORDER_PLACED",
    conditions: [],
    actions: [{ type: "NOTIFY_ADMINS", config: {} }],
    isActive: true,
  });
  console.log("CREATED rule \"" + RULE_NAME + "\" (" + created.data.publicId + ") — every new order now notifies every active admin.");
})().catch((err) => { console.error(err.message); process.exit(1); });
'

echo
echo "Done. Place a real order and check the bell (top-right) a moment"
echo "later — you can also see/edit this rule at Automation > Workflows."

#!/usr/bin/env bash
# Verifies the price-list currency fix actually made it into the running
# api container — checks the built code for it, then reproduces both the
# good (USD) and bad (unregistered currency) cases against the live API.
# Run from the repo root:
#   git pull && ./deploy/verify-price-list-currency-fix.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=================================================================="
echo "0. Is the fix actually present in the running container's built code?"
echo "=================================================================="
$COMPOSE exec api sh -c "grep -l CurrencyLookup dist/src/modules/pricing/*.js dist/src/modules/pricing/*/*.js 2>/dev/null" \
  && echo "FOUND — fix is present in this build." \
  || echo "NOT FOUND — this container is running OLD code without the fix. Rebuild needed."

echo
read -rp "Admin email: " ADMIN_EMAIL
read -rsp "Admin password: " ADMIN_PASSWORD
echo

$COMPOSE exec -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" api node -e '
const base = "http://localhost:3000";

async function main() {
  const loginRes = await fetch(`${base}/admin/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  const loginBody = await loginRes.json().catch(() => null);
  if (!loginRes.ok) {
    console.log("LOGIN FAILED:", loginRes.status, JSON.stringify(loginBody));
    process.exit(1);
  }
  const token = loginBody.data.token;
  console.log("Login OK.\n");

  console.log("=== Test 1: currency=USD (should succeed, 201) ===");
  const goodCode = `VERIFY-GOOD-${Date.now()}`;
  const good = await fetch(`${base}/admin/v1/price-lists`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: goodCode, name: "Verify Good", currency: "USD", type: "BASE", priority: 0 }),
  });
  console.log(`-> ${good.status}`);
  console.log(JSON.stringify(await good.json().catch(() => null), null, 2));

  console.log("\n=== Test 2: currency=ZZZ, unregistered (should be a clean 404, NOT 500) ===");
  const badCode = `VERIFY-BAD-${Date.now()}`;
  const bad = await fetch(`${base}/admin/v1/price-lists`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: badCode, name: "Verify Bad", currency: "ZZZ", type: "BASE", priority: 0 }),
  });
  console.log(`-> ${bad.status}`);
  console.log(JSON.stringify(await bad.json().catch(() => null), null, 2));
}

main().catch((err) => { console.error("SCRIPT ERROR:", err); process.exit(1); });
'

echo
echo "Done. Copy this WHOLE output back."

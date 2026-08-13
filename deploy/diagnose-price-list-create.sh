#!/usr/bin/env bash
# Diagnoses "Internal Server Error when creating a new price list" —
# creates a throwaway price list directly against the backend API, then
# immediately tails the api container's logs so we see the actual
# unhandled exception/stack trace, not just the generic error title the
# frontend shows.
# Run from the repo root:
#   git pull && ./deploy/diagnose-price-list-create.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

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

  const code = `DIAG-PL-${Date.now()}`;
  const res = await fetch(`${base}/admin/v1/price-lists`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code, name: "Diagnostic Price List", currency: "USD", type: "BASE", priority: 0 }),
  });
  const body = await res.json().catch(() => null);
  console.log(`POST /admin/v1/price-lists (code=${code}) -> ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
}

main().catch((err) => { console.error("SCRIPT ERROR:", err); process.exit(1); });
'

echo
echo "=================================================================="
echo "api container logs (last 80 lines) — look for a stack trace timed"
echo "right around the request above."
echo "=================================================================="
$COMPOSE logs api --tail 80

echo
echo "Done. Copy this WHOLE output back."

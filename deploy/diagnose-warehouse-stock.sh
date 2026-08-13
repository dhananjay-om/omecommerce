#!/usr/bin/env bash
# Diagnoses the "400 when clicking a warehouse tab on /inventory" report —
# hits the backend API directly (bypassing nginx/browser) for every
# warehouse's stock endpoint and prints the exact status + error body.
# Run from the repo root:
#   git pull && ./deploy/diagnose-warehouse-stock.sh
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

  const whRes = await fetch(`${base}/admin/v1/warehouses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const whBody = await whRes.json().catch(() => null);
  console.log("GET /admin/v1/warehouses ->", whRes.status);
  console.log(JSON.stringify(whBody, null, 2));
  console.log();

  if (!whRes.ok) return;

  for (const w of whBody.data) {
    const url = `${base}/admin/v1/inventory/warehouses/${encodeURIComponent(w.code)}/stock`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => null);
    console.log(`GET /admin/v1/inventory/warehouses/${w.code}/stock -> ${res.status}`);
    if (!res.ok) {
      console.log(JSON.stringify(body, null, 2));
    } else {
      console.log(`  OK, ${Array.isArray(body?.data) ? body.data.length : "?"} stock item(s)`);
    }
    console.log();
  }
}

main().catch((err) => { console.error("SCRIPT ERROR:", err); process.exit(1); });
'

echo "Done. Copy this WHOLE output back."

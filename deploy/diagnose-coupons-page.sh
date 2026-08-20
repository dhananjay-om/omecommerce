#!/usr/bin/env bash
# Diagnoses "This page couldn't load" / a server-error page on /admin/coupons
# (or any other admin route — pass a path as $1) — checks the raw HTTP
# response straight from the server (bypassing DNS/TLS/browser entirely),
# then the admin container's own recent logs, which will show the actual
# stack trace if it crashed rendering the page.
#
# Run from the repo root:
#   git pull && ./deploy/diagnose-coupons-page.sh [path]
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
ROUTE="${1:-/admin/coupons}"

echo "=================================================================="
echo "1. Container status — is admin actually up?"
echo "=================================================================="
$COMPOSE ps admin api

echo
echo "=================================================================="
echo "2. Direct request to the admin container itself (bypasses nginx/TLS)"
echo "=================================================================="
$COMPOSE exec admin node -e "
fetch('http://localhost:3000${ROUTE}')
  .then(async (r) => {
    console.log('status:', r.status);
    const text = await r.text();
    console.log('body length:', text.length);
    console.log('first 500 chars:', text.slice(0, 500));
  })
  .catch((e) => console.error('FETCH FAILED:', e.message));
"

echo
echo "=================================================================="
echo "3. admin container logs (last 200 lines) — look for a stack trace"
echo "=================================================================="
$COMPOSE logs admin --tail 200

echo
echo "=================================================================="
echo "4. api container logs (last 100 lines) — in case the crash is really"
echo "   here (admin calling a backend route that's erroring)"
echo "=================================================================="
$COMPOSE logs api --tail 100

echo
echo "=================================================================="
echo "Done. Copy this WHOLE output back."
echo "=================================================================="

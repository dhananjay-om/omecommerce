#!/usr/bin/env bash
# Ad-hoc diagnostic for the "product detail page won't load" issue.
# Run from the repo root: git pull && ./deploy/diagnose-product-detail.sh
# Then copy the WHOLE output back.
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
PRODUCT_ID="01a01e26-3bd4-706f-97b8-044d8ef8870c"

echo "=================================================================="
echo "0. Container status (look at RESTARTS — a crash loop is the #1 suspect)"
echo "=================================================================="
$COMPOSE ps
echo
docker inspect --format '{{.Name}}: restarts={{.RestartCount}} status={{.State.Status}} oom={{.State.OOMKilled}}' \
  $($COMPOSE ps -q admin) $($COMPOSE ps -q api) 2>&1

echo
echo "=================================================================="
echo "1a. Working page for comparison — admin login (should be a clean 200)"
echo "=================================================================="
curl -Is "https://omecom.vcto.in/admin/login" 2>&1 | head -10

echo
echo "=================================================================="
echo "1b. Working page for comparison — products LIST page"
echo "=================================================================="
curl -Is "https://omecom.vcto.in/admin/products" 2>&1 | head -10

echo
echo "=================================================================="
echo "1c. The FAILING page — direct HTTPS request to the specific product (verbose)"
echo "=================================================================="
curl -v "https://omecom.vcto.in/admin/products/${PRODUCT_ID}" 2>&1 | tail -60

echo
echo "=================================================================="
echo "2. Same product, direct to the backend API (no auth — expect 401,"
echo "   just checking the connection itself doesn't hang/crash)"
echo "=================================================================="
curl -v "http://localhost:4100/admin/v1/products/${PRODUCT_ID}" 2>&1 | tail -40

echo
echo "=================================================================="
echo "3. admin container logs (last 200 lines) — this is the one we need"
echo "=================================================================="
$COMPOSE logs admin --tail 200

echo
echo "=================================================================="
echo "4. api container logs (last 100 lines)"
echo "=================================================================="
$COMPOSE logs api --tail 100

echo
echo "=================================================================="
echo "Done. Copy this WHOLE output back."
echo "=================================================================="

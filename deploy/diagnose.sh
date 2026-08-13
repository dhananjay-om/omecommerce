#!/usr/bin/env bash
# Ad-hoc diagnostic/fix script — bundles the exact steps being run by hand in
# chat, so nothing needs to be copy-pasted from the terminal on the machine
# reading this into the server's terminal. Run from the repo root:
#   git pull && ./deploy/diagnose.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=================================================================="
echo "1. Force-recreate admin (picks up the 127.0.0.1:7975 port mapping)"
echo "=================================================================="
$COMPOSE up -d --force-recreate admin

echo
echo "=================================================================="
echo "2. What port is admin actually published on now?"
echo "=================================================================="
docker port omecommerce-admin-1

echo
echo "=================================================================="
echo "3. Full container list"
echo "=================================================================="
$COMPOSE ps

echo
echo "=================================================================="
echo "4. Direct HTTPS request to the site (bypassing the browser)"
echo "=================================================================="
curl -Iv https://omecom.vcto.in/ 2>&1 | tail -30

echo
echo "=================================================================="
echo "5. Last 30 lines of the host nginx error log for this domain"
echo "=================================================================="
tail -30 /var/log/nginx/omecom.vcto.in.error.log

echo
echo "=================================================================="
echo "6. storefront container logs (last 100 lines)"
echo "=================================================================="
$COMPOSE logs storefront --tail 100

echo
echo "=================================================================="
echo "Done. Copy this WHOLE output back."
echo "=================================================================="

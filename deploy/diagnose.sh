#!/usr/bin/env bash
# Ad-hoc diagnostic script — bundles diagnostic steps so nothing needs to be
# copy-pasted from chat into a remote terminal. Run from the repo root:
#   git pull && ./deploy/diagnose.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=================================================================="
echo "0. Container status — is everything actually up/healthy right now?"
echo "=================================================================="
$COMPOSE ps

echo
echo "=================================================================="
echo "0b. nginx service status (host-level)"
echo "=================================================================="
systemctl is-active nginx 2>&1 || echo "(not root/no permission — skip if this errors)"

echo
echo "=================================================================="
echo "1. Admin login page — direct HTTPS request"
echo "=================================================================="
curl -Is https://omecom.vcto.in/admin/login 2>&1 | head -5

echo
echo "=================================================================="
echo "2. Storefront homepage — direct HTTPS request"
echo "=================================================================="
curl -Is https://omecom.vcto.in/ 2>&1 | head -5

echo
echo "=================================================================="
echo "3. api container logs (last 150 lines) — this is the one we need"
echo "=================================================================="
$COMPOSE logs api --tail 150

echo
echo "=================================================================="
echo "Done. Copy this WHOLE output back."
echo "=================================================================="

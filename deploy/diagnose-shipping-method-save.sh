#!/usr/bin/env bash
# Captures the exact backend error behind the "Internal Server Error" seen
# when saving a New Shipping Method or New Payment Method in the admin.
# Run from the repo root:
#   ./deploy/diagnose-shipping-method-save.sh
# It watches the api container's logs for 25 seconds — during that window,
# go back to the admin in your browser and click "Create Shipping Method"
# (fill in Code/Name/Flat rate/Currency first) or "Create Payment Method"
# again, so the failing request happens while it's watching. Then copy the
# WHOLE output back here.
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=================================================================="
echo "Container status"
echo "=================================================================="
$COMPOSE ps

echo
echo "=================================================================="
echo "Watching api logs for 25 seconds — NOW go click 'Create Shipping"
echo "Method' (or 'Create Payment Method') again in the admin UI."
echo "=================================================================="
timeout 25 $COMPOSE logs -f api --tail 0

echo
echo "=================================================================="
echo "Done. Copy this WHOLE output back (especially any stack trace)."
echo "=================================================================="

#!/usr/bin/env bash
# Diagnostic only — makes no changes. Round 5.
#
# Round 4's live watch caught nothing at all — not even routine noise —
# which most likely means the 60-second window closed before the
# reproduction actually happened (compose needs a couple seconds to
# attach before it starts printing). This gives more time and prints a
# very explicit "GO NOW" line, then also dumps a static tail afterward
# as a safety net in case the live watch still misses the exact moment.
#
# HOW TO RUN THIS ONE (do the setup BEFORE starting the script):
#   1. In your browser, log into the admin and navigate to
#      Fulfillment > Returns ALREADY, with your mouse over the Approve
#      button, ready to click — don't click yet.
#   2. Run: ./deploy/diagnose-returns-approve.sh
#   3. The moment it prints "GO — CLICK APPROVE NOW", click it.
#   4. Wait for the script to finish on its own (~2 minutes), then copy
#      everything it printed back into the chat.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "Attaching to the admin container's live logs..."
( timeout 110 $COMPOSE logs -f --tail=0 admin 2>&1 ) &
LOG_PID=$!
sleep 3
echo
echo "###################################################################"
echo "#  GO — CLICK APPROVE NOW (you have about 100 seconds)"
echo "###################################################################"
echo
wait "$LOG_PID"

echo
echo "==================================================================="
echo "Safety net: last 100 lines of admin logs regardless of the above"
echo "==================================================================="
$COMPOSE logs --tail=100 admin 2>&1

echo
echo "==> Copy everything above this line back into the chat."

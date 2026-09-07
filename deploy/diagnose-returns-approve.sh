#!/usr/bin/env bash
# Diagnostic only — makes no changes. Round 4.
#
# The browser screenshot changed the picture: the failing request is
# named "returns" and its response is an RSC error payload
# (`1:E{"digest":"..."}`) — that means the RETURNS PAGE ITSELF is
# throwing while rendering (a Server Component error), not the api
# backend. Next.js deliberately hides the real error message from the
# browser in production (to avoid leaking details) but it DOES print
# the full message + stack to the admin container's own server log,
# tagged with that same digest. That's what this grabs.
#
# HOW TO RUN THIS ONE:
#   1. Run this script FIRST: ./deploy/diagnose-returns-approve.sh
#   2. As soon as it prints "Watching now...", go reproduce the error
#      again (open Fulfillment > Returns, click Approve).
#   3. Wait for it to finish on its own (60 seconds), then copy
#      everything it printed back into the chat.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "Watching the admin container's logs now — go reproduce the error"
echo "(open Fulfillment > Returns, click Approve)."
echo "(waiting 60 seconds, then this will stop on its own)"
echo "==================================================================="
timeout 60 $COMPOSE logs -f --since=1s admin 2>&1
echo "==================================================================="
echo "==> Done watching. Copy everything above this line back into the chat."

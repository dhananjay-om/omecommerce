#!/usr/bin/env bash
# Automation: Scheduled Jobs (Phase 1 of 2 — Rules/Workflows are next).
#
# Real visibility into this store's existing background jobs (reservation
# sweep, stored-value hold sweep, analytics nightly refresh, AI insights
# nightly refresh) — job name, schedule, and REAL run history (status,
# duration, error if any). This is a genuinely new record: BullMQ itself
# keeps zero job history (both queues clear completed/failed jobs
# immediately), so each of those 4 job handlers now writes a real
# job_run_log row on every run, start to finish.
#
# New permissions: automation:view (see jobs/run history),
# automation:manage (reserved for Phase 2's Rules/Workflows — nothing
# uses it yet). Needs Sync Permissions + relogin, same as every prior new
# permission this project has added — see below.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-automation-scheduled-jobs.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new job_run_log table"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Automation > Scheduled Jobs)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete."
echo
echo "IMPORTANT — one manual step: open Stores > Admin Permissions and click"
echo "'Sync Permissions' to register automation:view/automation:manage, then"
echo "log out and back in so your own session picks up the new permission."
echo "Without this, Automation > Scheduled Jobs will 403 even for you."
echo
echo "Open Automation > Scheduled Jobs — you'll see real run history build up"
echo "over the next minute or two as the reservation/stored-value sweeps run."

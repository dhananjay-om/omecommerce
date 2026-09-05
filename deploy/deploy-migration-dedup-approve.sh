#!/usr/bin/env bash
# Data Migration: no duplicate attributes/attribute sets, and a clear
# "approve the plan" step with real counts before Start Migration runs.
#
# Two things, both from direct user feedback:
#
# 1. Duplicate-prevention safety net. The plan already avoided duplicates
#    when the AI's proposed code matched an existing one exactly — but the
#    AI's "newAttributeCode"/"newAttributeSetCode" text isn't guaranteed to
#    come out identical across two separate Check Migration runs for the
#    same real concept (e.g. "color" one time, "colour_option" another).
#    The worker now ALSO checks by real label/name (case-insensitive) before
#    ever creating a new attribute or attribute set — if one already exists
#    under that exact name, it's reused, never duplicated, regardless of
#    what the plan's code-based decision said to do.
#
# 2. The Migration Plan card now shows a clear count for each category —
#    "N new, M matched to existing" — for Categories, Attributes, and
#    Attribute Sets, right at the top. Start Migration is now gated behind
#    an explicit "I've reviewed ... and approve this plan" checkbox, so
#    starting a migration is a deliberate, informed action, not just a
#    button an admin might click without having actually looked at what
#    will be created.
#
# No schema change, no new permission.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-migration-dedup-approve.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (duplicate-prevention safety net in the migration worker)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Rebuilding admin (plan counts + Approve & Start Migration gate)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No migration, no permission change."
echo "The next migration run's plan card shows real counts per category,"
echo "and Start Migration stays disabled until the review checkbox is ticked."

#!/usr/bin/env bash
# Seeds ~9 realistic demo products (with real images, categories, brands,
# prices, stock) — the same script used locally, run inside the api
# container so it has network access to postgres/minio by their internal
# Docker names, and its own already-correct DATABASE_URL/S3_ENDPOINT env.
# Idempotent — safe to re-run.
#
# Run from the repo root: ./deploy/seed-demo-data.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e API_BASE_URL=http://localhost:3000 \
  api node scripts/seed-demo-data.mjs

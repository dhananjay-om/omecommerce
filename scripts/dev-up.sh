#!/usr/bin/env bash
# Starts the full local dev stack: infra containers, backend API, admin frontend.
# Safe to re-run — skips anything already up.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${DEV_LOG_DIR:-/tmp/ome-dev-logs}"
mkdir -p "$LOG_DIR"

echo "==> Starting infra containers"
for c in ome-pg-dev ome-redis-dev ome-os-dev ome-minio-dev; do
  if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || echo false)" != "true" ]; then
    if docker inspect "$c" >/dev/null 2>&1; then
      docker start "$c" >/dev/null
      echo "    started $c"
    else
      echo "    !! container $c does not exist — create it first (see scripts/dev-up.sh header notes)"
    fi
  else
    echo "    $c already running"
  fi
done

echo "==> Waiting for Postgres + OpenSearch"
for i in $(seq 1 30); do
  pg_ok=$(docker exec ome-pg-dev pg_isready -U ome -d ome 2>&1 | grep -c "accepting connections" || true)
  os_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9200/_cluster/health --max-time 2 || true)
  [ "$pg_ok" = "1" ] && [ "$os_ok" = "200" ] && break
  sleep 2
done

export DATABASE_URL="postgresql://ome:ome@localhost:55433/ome?schema=public"
export REDIS_URL="redis://localhost:56379"
export OPENSEARCH_URL="http://localhost:9200"
export JWT_SECRET="dev-only-jwt-secret-change-me-please-32ch"
export GIFT_CARD_HMAC_SECRET="dev-only-giftcard-hmac-secret-change-me"
export S3_ENDPOINT="http://localhost:59000"
export S3_ACCESS_KEY="ome"
export S3_SECRET_KEY="ome-secret"
export S3_BUCKET="ome-media"

echo "==> Starting backend API (port 4100)"
if curl -s -o /dev/null http://localhost:4100/health --max-time 2; then
  echo "    already running"
else
  cd "$REPO_ROOT"
  if [ ! -f dist/src/main.js ]; then
    echo "    building backend first..."
    npm run build >"$LOG_DIR/backend-build.log" 2>&1
  fi
  # PORT is scoped to just this command, not exported globally — an earlier
  # version exported it for the whole script, which leaked into admin's
  # `next dev` below (no -p flag) and made it try to bind :4100 too,
  # crashing with EADDRINUSE instead of ever reaching port 3000.
  PORT=4100 nohup node dist/src/main.js >"$LOG_DIR/backend.log" 2>&1 &
  disown
  for i in $(seq 1 15); do
    curl -s -o /dev/null http://localhost:4100/health --max-time 2 && break
    sleep 1
  done
  echo "    started, logs: $LOG_DIR/backend.log"
fi

echo "==> Starting admin frontend (port 3000)"
if curl -s -o /dev/null http://localhost:3000/login --max-time 2; then
  echo "    already running"
else
  cd "$REPO_ROOT/apps/admin"
  nohup npm run dev >"$LOG_DIR/frontend.log" 2>&1 &
  disown
  for i in $(seq 1 30); do
    curl -s -o /dev/null http://localhost:3000/login --max-time 2 && break
    sleep 1
  done
  echo "    started, logs: $LOG_DIR/frontend.log"
fi

echo "==> Starting storefront frontend (port 3001)"
if curl -s -o /dev/null http://localhost:3001 --max-time 2; then
  echo "    already running"
else
  cd "$REPO_ROOT/apps/storefront"
  nohup npm run dev >"$LOG_DIR/storefront.log" 2>&1 &
  disown
  for i in $(seq 1 30); do
    curl -s -o /dev/null http://localhost:3001 --max-time 2 && break
    sleep 1
  done
  echo "    started, logs: $LOG_DIR/storefront.log"
fi

echo "==> Done. Admin UI: http://localhost:3000  Storefront: http://localhost:3001"

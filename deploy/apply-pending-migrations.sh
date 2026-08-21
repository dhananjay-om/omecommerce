#!/usr/bin/env bash
# Applies any database migration that's been committed to the repo but never
# actually run against this server's database. Confirmed root cause of the
# product detail/edit page crash: the `api` container is running code that
# expects `product.slug` to exist (added by the SEO-friendly product URLs
# feature), but that migration was never applied here — Postgres has been up
# 8 days straight with no restart, so whichever deploy was supposed to run
# it either wasn't run or the migration step never happened.
#
# `prisma migrate deploy` is idempotent and safe to run any time — it only
# applies migrations not yet recorded as applied; anything already applied
# is a no-op. Safe to re-run this script whenever in doubt.
#
# Run from the repo root, after `git pull`: ./deploy/apply-pending-migrations.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Applying any pending database migrations"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo
echo "==> Done. Re-check the product page that was failing — it should load"
echo "    normally now. If it still errors, run ./deploy/diagnose-product-detail.sh"
echo "    again and share the new output."

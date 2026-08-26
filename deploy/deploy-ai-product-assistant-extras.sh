#!/usr/bin/env bash
# Deploys 5 extensions to the AI Product Assistant, all requested together:
#
#   1. AI on the product CREATE page (not just edit) — Generate from Image,
#      inline Generate/Generate Tags, and a reduced Quick Actions set
#      (Performance/Price need real sales history a new product doesn't
#      have yet, so those two stay edit-page-only).
#   2. Alt text generation per product image (Media tab) — a real
#      per-image alt-text editor + "Generate" button, writing to
#      ProductMedia.altOverride (previously no write path existed at all).
#   3. "Suggest Attribute Values" Quick Action — grounded against the
#      product's real attribute-set options (never invents a SELECT/
#      MULTISELECT option not in the real list); informational only, not
#      auto-applied (those are custom controlled components, not a safe
#      DOM write like Title/Tags/Description).
#   4. Real (minimal) product reviews + an AI "Summarize with AI" button
#      on the Reviews tab — new `product_review` table. Deliberately no
#      submission/moderation flow (see that table's own schema doc
#      comment) — just enough real customer text for the AI to summarize.
#   5. "Generate Missing Descriptions" bulk action from the product list —
#      a new BullMQ job (bulk-generate-descriptions) on the existing
#      bulk-jobs queue/worker, skips any product that already has a
#      description rather than overwriting it.
#
# New `product_review` table (migration) + several new
# POST /admin/v1/ai/products/:id/[...] and /admin/v1/products/... routes,
# all reusing the existing `ai:view`/`catalog:manage` permissions — no new
# permission to sync.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-ai-product-assistant-extras.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new product_review table + several new AI/media/bulk routes)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new product_review migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (Create-page AI card, Media tab alt text, Reviews tab, bulk bar button)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync this time."
echo
echo "The Reviews tab has nothing to summarize until real reviews exist —"
echo "this system has no storefront review-submission flow (see product_review's"
echo "own schema doc comment), so seed a few demo ones if you want to see the"
echo "AI Summary working: ./deploy/seed-demo-reviews.sh"
echo
echo "Every AI action still needs an OpenAI key configured (Stores > AI"
echo "Settings) to actually generate anything."

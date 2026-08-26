#!/usr/bin/env bash
# Deploys the AI Product Assistant — the per-product AI card on each
# product's Overview tab (previously a "Coming soon" mock, now fully wired):
#
#   - Generate from Image: upload a product photo (same presigned-upload
#     flow the Media tab uses) -> a vision-capable OpenAI call drafts
#     title/description/tags/SEO copy, grounded in the real product context.
#     Title/description/tags land directly in this page's own (still-
#     unsaved) form fields for review; SEO copy is applied on demand via
#     its own button (the SEO tab is a separate route).
#   - Inline "Generate"/"Generate Tags" next to the Title/Tags fields.
#   - 6 Quick Actions: Generate SEO Title, Generate Meta Description,
#     Analyze Product Performance (real sales numbers, LLM-narrated),
#     Suggest Price, Suggest Category (both grounded/informational, not
#     auto-applied), and Detect Missing Product Data (pure rule-based
#     checklist, no LLM call at all).
#
# New Product.tags column (plain string array, no Tag/ProductTag join
# table — see catalog.prisma's own doc comment) + a real tag-chip editor.
# New POST /admin/v1/ai/products/:id/[...] routes, all read-only from the
# DB's point of view (see product-assistant.usecase.ts's header comment) —
# reuses the existing ai:view permission, no new one to sync.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-ai-product-assistant.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api (new product.tags column + /admin/v1/ai/products/:id/[...] routes)"
$COMPOSE up -d --build api
if [ $? -ne 0 ]; then
  echo "!! api build/restart failed — see the output above" >&2
  exit 1
fi

echo "==> Applying the new product_tags migration"
$COMPOSE exec api npm run migrate:deploy
if [ $? -ne 0 ]; then
  echo "!! migration failed — see the output above, copy it back" >&2
  exit 1
fi

echo "==> Rebuilding admin (real AI Product Assistant card on every product's Overview tab)"
$COMPOSE up -d --build admin
if [ $? -ne 0 ]; then
  echo "!! admin build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Deploy complete. No new permission to sync this time."
echo
echo "Needs an OpenAI key configured (Stores > AI Settings) to actually"
echo "generate anything — without one, every AI action shows a clean"
echo "'needs an OpenAI key' message instead of a crash (verified locally)."
echo "The Generate-from-Image flow also needs the same S3_* / MinIO"
echo "config the Media tab's uploads already depend on — nothing new there."

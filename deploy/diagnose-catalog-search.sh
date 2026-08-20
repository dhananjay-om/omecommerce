#!/usr/bin/env bash
# Diagnoses a mismatch between "N products in the admin" and "more/fewer
# products showing on the storefront" — checks the actual Postgres product
# count, the actual OpenSearch document count, and whether any product has
# more than one indexed document (which would mean real duplicates, not
# just a perception/filter difference). Run from the repo root:
#   git pull && ./deploy/diagnose-catalog-search.sh
set -uo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "=================================================================="
echo "1. Products in Postgres, by status/type"
echo "=================================================================="
$COMPOSE exec api node -e '
import("@prisma/client").then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  const total = await prisma.product.count({ where: { deletedAt: null } });
  const byStatus = await prisma.product.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true });
  const byType = await prisma.product.groupBy({ by: ["type"], where: { deletedAt: null }, _count: true });
  console.log("Total non-deleted products:", total);
  console.log("By status:", JSON.stringify(byStatus));
  console.log("By type:", JSON.stringify(byType));
  const rows = await prisma.product.findMany({ where: { deletedAt: null }, select: { sku: true, nameDefault: true, status: true, type: true }, orderBy: { id: "asc" } });
  console.log("All SKUs:", JSON.stringify(rows));
  await prisma.$disconnect();
}).catch((err) => { console.error(err); process.exit(1); });
'

echo
echo "=================================================================="
echo "2. Store views (should normally be exactly 1 on a single-tenant deploy)"
echo "=================================================================="
$COMPOSE exec api node -e '
import("@prisma/client").then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  const views = await prisma.storeView.findMany({ select: { id: true, code: true, status: true } });
  console.log(JSON.stringify(views));
  await prisma.$disconnect();
}).catch((err) => { console.error(err); process.exit(1); });
'

echo
echo "=================================================================="
echo "3. OpenSearch: total documents in the product index"
echo "=================================================================="
$COMPOSE exec api node -e "
fetch('http://opensearch:9200/product_search/_count')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d)))
  .catch(e => console.error(e));
"

echo
echo "=================================================================="
echo "4. OpenSearch: document count PER productId — anything >1 here is a"
echo "   real duplicate (there should be exactly 1 document per product"
echo "   per store view)"
echo "=================================================================="
$COMPOSE exec api node -e "
fetch('http://opensearch:9200/product_search/_search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    size: 0,
    aggs: { by_product: { terms: { field: 'productId', size: 1000, min_doc_count: 1 } } },
  }),
})
  .then(r => r.json())
  .then(d => {
    const buckets = d.aggregations?.by_product?.buckets ?? [];
    console.log('Distinct productIds indexed:', buckets.length);
    const dupes = buckets.filter((b) => b.doc_count > 1);
    console.log('productIds with MORE than 1 document (real duplicates):', JSON.stringify(dupes));
  })
  .catch(e => console.error(e));
"

echo
echo "=================================================================="
echo "Done. Copy this WHOLE output back."
echo "=================================================================="

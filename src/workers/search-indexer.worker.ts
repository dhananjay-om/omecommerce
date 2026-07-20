import type { Job } from 'bullmq';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { getOpenSearchClient } from '../shared/infrastructure/search/opensearch-client.js';
import { OpenSearchIndex } from '../modules/search/infrastructure/opensearch-search-index.js';
import {
  PrismaProductLookup,
  PrismaStoreViewLookup,
  PrismaAttributeFlagsLookup,
  PrismaStockAvailabilityLookup,
  PrismaCategoryMembershipLookup,
} from '../modules/search/infrastructure/prisma-lookups.js';
import { PrismaProductAttributeStore } from '../modules/catalog/infrastructure/product-attribute.store.js';
import { PrismaPriceResolver } from '../modules/pricing/infrastructure/prisma-price-resolver.js';
import { IndexProduct } from '../modules/search/application/index-product.usecase.js';

const INDEXABLE_EVENTS = new Set(['ProductCreated', 'ProductAttributeChanged']);

/**
 * Consumes Catalog's outbox events and keeps the search index near-real-time
 * (plan/06 §5). Price/stock changes do NOT yet trigger reindexing — Pricing and
 * Inventory don't emit outbox events in this stage — so search can lag behind a
 * price/stock change until the next full reindex; documented, not silent.
 * Category assignment changes (`SetProductCategories`) are the same story — no
 * outbox event either, so the `__category` facet also only picks up a reassign
 * after a manual `POST /admin/v1/search/reindex`.
 *
 * Exported as a handler factory, not its own Worker — see
 * order-confirmation.worker.ts's header comment on why DOMAIN_EVENTS_QUEUE's
 * consumers all share ONE Worker (wired in workers/index.ts) instead of one
 * each.
 */
export function createSearchIndexHandler(): (job: Job) => Promise<void> {
  const index = new OpenSearchIndex(getOpenSearchClient());
  const products = new PrismaProductLookup(prisma);
  const storeViews = new PrismaStoreViewLookup(prisma);
  const attributeStore = new PrismaProductAttributeStore(prisma);
  const facetableAttributes = new PrismaAttributeFlagsLookup(prisma);
  const priceResolver = new PrismaPriceResolver(prisma);
  const stockAvailability = new PrismaStockAvailabilityLookup(prisma);
  const categoryMembership = new PrismaCategoryMembershipLookup(prisma);
  const indexProduct = new IndexProduct(
    products,
    storeViews,
    attributeStore,
    facetableAttributes,
    priceResolver,
    stockAvailability,
    categoryMembership,
    index,
  );

  return async (job: Job) => {
    if (!INDEXABLE_EVENTS.has(job.name)) return;
    const { aggregateId } = job.data as { aggregateId: string };
    await index.ensureIndex();
    await indexProduct.execute(aggregateId);
  };
}

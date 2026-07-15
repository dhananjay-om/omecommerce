import { Worker } from 'bullmq';
import { DOMAIN_EVENTS_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { getOpenSearchClient } from '../shared/infrastructure/search/opensearch-client.js';
import { OpenSearchIndex } from '../modules/search/infrastructure/opensearch-search-index.js';
import {
  PrismaProductLookup,
  PrismaStoreViewLookup,
  PrismaAttributeFlagsLookup,
  PrismaStockAvailabilityLookup,
} from '../modules/search/infrastructure/prisma-lookups.js';
import { PrismaProductAttributeStore } from '../modules/catalog/infrastructure/product-attribute.store.js';
import { PrismaPriceResolver } from '../modules/pricing/infrastructure/prisma-price-resolver.js';
import { IndexProduct } from '../modules/search/application/index-product.usecase.js';
import { logger } from '../shared/infrastructure/logger.js';

const INDEXABLE_EVENTS = new Set(['ProductCreated', 'ProductAttributeChanged']);

/**
 * Consumes Catalog's outbox events and keeps the search index near-real-time
 * (plan/06 §5). Price/stock changes do NOT yet trigger reindexing — Pricing and
 * Inventory don't emit outbox events in this stage — so search can lag behind a
 * price/stock change until the next full reindex; documented, not silent.
 */
export function startSearchIndexerWorker(): Worker {
  const index = new OpenSearchIndex(getOpenSearchClient());
  const products = new PrismaProductLookup(prisma);
  const storeViews = new PrismaStoreViewLookup(prisma);
  const attributeStore = new PrismaProductAttributeStore(prisma);
  const facetableAttributes = new PrismaAttributeFlagsLookup(prisma);
  const priceResolver = new PrismaPriceResolver(prisma);
  const stockAvailability = new PrismaStockAvailabilityLookup(prisma);
  const indexProduct = new IndexProduct(products, storeViews, attributeStore, facetableAttributes, priceResolver, stockAvailability, index);

  const worker = new Worker(
    DOMAIN_EVENTS_QUEUE,
    async (job) => {
      if (!INDEXABLE_EVENTS.has(job.name)) return;
      const { aggregateId } = job.data as { aggregateId: string };
      await index.ensureIndex();
      await indexProduct.execute(aggregateId);
    },
    { connection: getQueueConnectionOptions() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'search indexer job failed'));
  return worker;
}

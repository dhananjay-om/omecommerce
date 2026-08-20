import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { getOpenSearchClient } from '../../shared/infrastructure/search/opensearch-client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaProductAttributeStore } from '../catalog/infrastructure/product-attribute.store.js';
import { PrismaPriceResolver } from '../pricing/infrastructure/prisma-price-resolver.js';
import { OpenSearchIndex } from './infrastructure/opensearch-search-index.js';
import { S3MediaUrlResolver } from './infrastructure/s3-media-url-resolver.js';
import {
  PrismaProductLookup,
  PrismaStoreViewLookup,
  PrismaAttributeFlagsLookup,
  PrismaStockAvailabilityLookup,
  PrismaCategoryMembershipLookup,
  PrismaBrandLookup,
  PrismaProductMediaLookup,
} from './infrastructure/prisma-lookups.js';
import { IndexProduct } from './application/index-product.usecase.js';
import { SearchProducts } from './application/search-products.usecase.js';
import { ReindexAll } from './application/reindex-all.usecase.js';
import { searchQuerySchema } from './interface/http/schemas.js';

export interface SearchModule {
  admin: Router;
  store: Router;
  indexProduct: IndexProduct;
  /** Runs a full reindex only if the index is currently empty while the catalog isn't
   *  (see its own doc comment) — call once at process boot. Never throws: OpenSearch
   *  being briefly unreachable at startup must not prevent the API server from booting. */
  reindexIfEmpty: () => Promise<void>;
}

/** Composition root for Search (plan/06). */
export function createSearchModule(
  db: Db,
  authorize: (permission: string) => RequestHandler,
): SearchModule {
  const client = getOpenSearchClient();
  const index = new OpenSearchIndex(client);

  const products = new PrismaProductLookup(db);
  const storeViews = new PrismaStoreViewLookup(db);
  const attributeStore = new PrismaProductAttributeStore(db);
  const facetableAttributes = new PrismaAttributeFlagsLookup(db);
  const priceResolver = new PrismaPriceResolver(db);
  const stockAvailability = new PrismaStockAvailabilityLookup(db);
  const categoryMembership = new PrismaCategoryMembershipLookup(db);
  const brandLookup = new PrismaBrandLookup(db);
  const productMedia = new PrismaProductMediaLookup(db);
  const mediaUrlResolver = new S3MediaUrlResolver();

  const indexProduct = new IndexProduct(
    products,
    storeViews,
    attributeStore,
    facetableAttributes,
    priceResolver,
    stockAvailability,
    categoryMembership,
    brandLookup,
    productMedia,
    index,
  );
  const searchProducts = new SearchProducts(index, mediaUrlResolver);
  const reindexAll = new ReindexAll(products, index, indexProduct);

  /**
   * OpenSearch's index doesn't reliably survive a container restart the way
   * Postgres does in dev (no guaranteed persistent volume) — every prior
   * reindex was manual, discovered only after a shopper hit an empty PLP.
   * Runs a full ReindexAll automatically at boot, but ONLY when the index is
   * empty while the catalog genuinely has active products — never on every
   * `tsx watch` hot-reload restart (which happens on every file save in dev;
   * an unconditional reindex there would recrawl the whole catalog on every
   * edit, real cost for no benefit once the index is already populated).
   * Swallows any error (a slow-to-start OpenSearch container, a transient
   * network blip) rather than ever blocking the API server from listening —
   * search staying momentarily stale is far better than the whole app
   * refusing to boot over it; worst case, the next manual reindex (or the
   * next restart) catches up.
   */
  async function reindexIfEmpty(): Promise<void> {
    try {
      const [indexedIds, activeProducts] = await Promise.all([
        index.listAllProductIds(),
        products.allActive(),
      ]);
      if (indexedIds.length > 0 || activeProducts.length === 0) return;
      const result = await reindexAll.execute();
      logger.info({ ...result }, 'search index was empty at boot — auto-reindexed');
    } catch (err) {
      logger.warn({ err }, 'search auto-reindex-if-empty failed at boot — continuing without it');
    }
  }

  const admin = Router();
  admin.post(
    '/search/reindex',
    authorize('admin:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await reindexAll.execute() });
    }),
  );

  const store = Router();
  store.get(
    '/search',
    asyncHandler(async (req, res) => {
      const query = parse(searchQuerySchema, req.query);
      const filters =
        typeof req.query.filter === 'object' && req.query.filter !== null
          ? (req.query.filter as Record<string, string>)
          : {};
      res.json({
        data: await searchProducts.execute({
          storeViewId: query.storeViewId,
          q: query.q,
          filters,
          priceMin: query.minPrice,
          priceMax: query.maxPrice,
          inStock: query.inStock,
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        }),
      });
    }),
  );

  return { admin, store, indexProduct, reindexIfEmpty };
}

import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { getOpenSearchClient } from '../../shared/infrastructure/search/opensearch-client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaProductAttributeStore } from '../catalog/infrastructure/product-attribute.store.js';
import { PrismaPriceResolver } from '../pricing/infrastructure/prisma-price-resolver.js';
import { OpenSearchIndex } from './infrastructure/opensearch-search-index.js';
import {
  PrismaProductLookup,
  PrismaStoreViewLookup,
  PrismaAttributeFlagsLookup,
  PrismaStockAvailabilityLookup,
  PrismaCategoryMembershipLookup,
} from './infrastructure/prisma-lookups.js';
import { IndexProduct } from './application/index-product.usecase.js';
import { SearchProducts } from './application/search-products.usecase.js';
import { ReindexAll } from './application/reindex-all.usecase.js';
import { searchQuerySchema } from './interface/http/schemas.js';

export interface SearchModule {
  admin: Router;
  store: Router;
  indexProduct: IndexProduct;
}

/** Composition root for Search (plan/06). */
export function createSearchModule(db: Db, authorize: (permission: string) => RequestHandler): SearchModule {
  const client = getOpenSearchClient();
  const index = new OpenSearchIndex(client);

  const products = new PrismaProductLookup(db);
  const storeViews = new PrismaStoreViewLookup(db);
  const attributeStore = new PrismaProductAttributeStore(db);
  const facetableAttributes = new PrismaAttributeFlagsLookup(db);
  const priceResolver = new PrismaPriceResolver(db);
  const stockAvailability = new PrismaStockAvailabilityLookup(db);
  const categoryMembership = new PrismaCategoryMembershipLookup(db);

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
  const searchProducts = new SearchProducts(index);
  const reindexAll = new ReindexAll(products, index, indexProduct);

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
      const filters = typeof req.query.filter === 'object' && req.query.filter !== null ? (req.query.filter as Record<string, string>) : {};
      res.json({
        data: await searchProducts.execute({
          storeViewId: query.storeViewId,
          q: query.q,
          filters,
          priceMin: query.minPrice,
          priceMax: query.maxPrice,
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
        }),
      });
    }),
  );

  return { admin, store, indexProduct };
}

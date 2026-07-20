import type { ProductLookup } from '../domain/repositories.js';
import type { SearchIndex } from '../domain/ports.js';
import type { IndexProduct } from './index-product.usecase.js';

/**
 * Full rebuild (plan/06 §5 "Full rebuild job"). Used to bootstrap the index or
 * recover from drift; the outbox-driven per-product indexing (Stage 4's
 * SearchIndexer worker) is the near-real-time path for ordinary edits.
 */
export class ReindexAll {
  constructor(
    private readonly products: ProductLookup,
    private readonly index: SearchIndex,
    private readonly indexProduct: IndexProduct,
  ) {}

  async execute(): Promise<{ indexed: number; removed: number }> {
    await this.index.ensureIndex();

    const [products, indexedProductIds] = await Promise.all([this.products.allActive(), this.index.listAllProductIds()]);

    // A full reindex must actually be full — a product removed outside the
    // normal flow (e.g. a test's raw TRUNCATE, which bypasses IndexProduct's
    // delete-on-missing-product path entirely) otherwise leaves an orphaned
    // document forever, since upsert-only re-indexing never removes what's
    // no longer in Postgres. Diff-and-delete only the true orphans, rather
    // than clearing the whole index and repopulating it — that has a real
    // window where concurrent searches would see nothing (or a dropped index,
    // an outright error), which a surgical diff never does.
    const activeProductIds = new Set(products.map((p) => p.publicId));
    const orphanIds = indexedProductIds.filter((id) => !activeProductIds.has(id));
    for (const id of orphanIds) {
      await this.index.deleteByProductId(id);
    }

    for (const p of products) {
      await this.indexProduct.execute(p.publicId);
    }
    return { indexed: products.length, removed: orphanIds.length };
  }
}

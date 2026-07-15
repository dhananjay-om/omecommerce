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

  async execute(): Promise<{ indexed: number }> {
    await this.index.ensureIndex();
    const products = await this.products.allActive();
    for (const p of products) {
      await this.indexProduct.execute(p.publicId);
    }
    return { indexed: products.length };
  }
}

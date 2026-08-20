import type { ProductRepository } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';

/**
 * Soft-delete, guarded: rejects a product that still has non-zero stock anywhere for any of its
 * variants — adjust stock to zero first (same shape as DeleteWarehouse's guard). Order history is
 * unaffected either way: OrderLine snapshots sku/name/price at placement and Order is never
 * soft-deleted itself, so past orders keep displaying correctly regardless of whether the product
 * is later deleted.
 */
export class DeleteProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(publicId: string): Promise<void> {
    const product = await this.products.findByPublicId(publicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', publicId);

    if (await this.products.hasStock(product.props.id)) {
      throw new ConflictError('cannot delete a product that still has stock — adjust its stock to zero first');
    }
    await this.products.softDelete(product.props.id);

    // Reuses the existing indexable event type (search-indexer.worker.ts's INDEXABLE_EVENTS) —
    // IndexProduct.execute() already deletes the OpenSearch doc when byPublicId() finds nothing,
    // which it now correctly does for a deletedAt-set product. No new worker wiring needed.
    await this.outbox.write({
      aggregateType: 'Product',
      aggregateId: publicId,
      eventType: 'ProductAttributeChanged',
      payload: { reason: 'product deleted' },
    });
  }
}

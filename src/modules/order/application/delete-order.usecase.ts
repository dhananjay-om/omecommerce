import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';

/**
 * Permanent delete — genuinely removes the order row (and everything under
 * it) from the database, unlike every other order action in this module.
 * This codebase otherwise treats an order as a permanent financial/audit
 * record on purpose (see delete-product.usecase.ts's and catalog's
 * repositories.ts's own "Order is never soft-deleted" comments) — this
 * use case exists specifically so cluttered demo/test/mistaken orders can
 * be cleaned up, not as a general-purpose "undo a sale" tool.
 *
 * Guarded to only CANCELLED/CLOSED orders precisely because of that: both
 * states are only reachable through CancelOrder/CloseOrder, which already
 * settled the order's money (refund) and stock (restock) correctly before
 * getting there. An order still PENDING/PROCESSING/etc. may have live
 * stock reservations and an uncaptured/unsettled payment — deleting it out
 * from under those would silently leak a stock hold or leave a payment
 * gateway charge with no order to reconcile against. Cancel or close it
 * first (both already exist), then delete.
 */
export class DeleteOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(orderPublicId: string): Promise<void> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);

    if (order.status !== 'CANCELLED' && order.status !== 'CLOSED') {
      throw new InvalidOrderStateError(
        `order ${orderPublicId} is ${order.status} — cancel or close it first, then delete`,
      );
    }

    await this.orders.hardDelete(order.id);

    // The event-driven analytics projector (analytics-projector.worker.ts)
    // normally re-derives websiteId/placedAt by looking the order back up
    // by aggregateId — impossible here since the row is now gone, so this
    // event carries them directly in its payload instead. The projector
    // special-cases 'OrderDeleted' for exactly that reason.
    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'OrderDeleted',
      payload: { orderNumber: order.orderNumber, websiteId: order.websiteId.toString(), placedAt: order.placedAt.toISOString() },
    });
  }
}

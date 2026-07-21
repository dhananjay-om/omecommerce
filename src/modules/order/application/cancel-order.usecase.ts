import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import { RefundOrder } from './refund-order.usecase.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { CancelOrderCommand, OrderViewDto } from './dto.js';

/**
 * Cancel = full refund (with restock) of every line + mark the order CANCELLED.
 * Only allowed while nothing has shipped yet (plan/08 §4) — once any line is
 * fulfilled, use the return/RMA flow for the fulfilled portion instead.
 */
export class CancelOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly refundOrder: RefundOrder,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: CancelOrderCommand): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);
    if (order.fulfillmentStatus !== 'UNFULFILLED') {
      throw new InvalidOrderStateError(
        `order ${cmd.orderPublicId} has already been (partially) fulfilled — use a return instead of cancelling`,
      );
    }

    const result = await this.refundOrder.execute({
      orderPublicId: cmd.orderPublicId,
      lines: order.lines.map((l) => ({ sku: l.sku, qty: l.qty - l.refundedQty })).filter((l) => l.qty > 0),
      restock: true,
      refundTo: cmd.refundTo,
    });

    await this.orders.setOrderStatus(order.id, 'CANCELLED');
    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'OrderCancelled',
      payload: { orderNumber: order.orderNumber, reason: cmd.reason ?? null },
    });
    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'CANCELLED',
      fromValue: order.status,
      toValue: 'CANCELLED',
      message: cmd.reason ? `Order cancelled: ${cmd.reason}` : 'Order cancelled',
      actorType: 'ADMIN',
    });
    return { ...result, status: 'CANCELLED' };
  }
}

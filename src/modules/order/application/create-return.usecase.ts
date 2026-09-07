import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateReturnCommand } from './dto.js';

/** The genuinely missing write path this feature area's own plan flagged
 *  — OrderReturn/OrderReturnLine already existed in the schema (even read
 *  by GetOrder's own DTO) but nothing ever created one. Admin-recorded
 *  only (confirmed decision): an admin logs a return that already
 *  happened over phone/email/support, same "addressed by sku" contract
 *  as FulfillOrder/RefundOrder. */
export class CreateReturn {
  constructor(private readonly orders: OrderRepository) {}

  async execute(cmd: CreateReturnCommand): Promise<{ publicId: string }> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);

    const lines: Array<{ orderLineId: bigint; qty: number; restock: boolean }> = [];
    for (const requested of cmd.lines) {
      const line = order.lines.find((l) => l.sku === requested.sku);
      if (!line) throw new NotFoundError('OrderLine', requested.sku);
      const alreadyReturnable = line.qty - line.refundedQty;
      if (requested.qty > alreadyReturnable) {
        throw new ValidationError(`cannot return ${requested.qty} of ${requested.sku} — only ${alreadyReturnable} not already refunded`, [
          { path: 'lines', message: `${requested.sku}: qty exceeds what's refundable` },
        ]);
      }
      lines.push({ orderLineId: line.id, qty: requested.qty, restock: requested.restock ?? true });
    }

    const created = await this.orders.createReturn({ orderId: order.id, reason: cmd.reason, lines });

    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'RETURN_CREATED',
      message: `Return requested (${lines.length} line(s)): ${cmd.reason}`,
      actorType: 'ADMIN',
    });

    return { publicId: created.publicId };
  }
}

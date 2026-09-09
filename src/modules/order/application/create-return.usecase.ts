import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import type { CreateReturnCommand } from './dto.js';

/** The genuinely missing write path this feature area's own plan flagged
 *  — OrderReturn/OrderReturnLine already existed in the schema (even read
 *  by GetOrder's own DTO) but nothing ever created one. Originally
 *  admin-recorded only; a logged-in customer can now also submit one
 *  (via CreateCustomerReturn, ownership-checked, reusing this exact
 *  usecase — no second write path), same "addressed by sku" contract as
 *  FulfillOrder/RefundOrder.
 *
 *  Guarded to FULFILLED/PARTIALLY_FULFILLED orders — you can't return
 *  something that was never actually shipped to you. This was a real,
 *  pre-existing gap even for the admin-only version of this usecase
 *  (nothing checked it), closed here rather than left unguarded now that
 *  a customer can trigger this directly. */
export class CreateReturn {
  constructor(private readonly orders: OrderRepository) {}

  async execute(cmd: CreateReturnCommand): Promise<{ publicId: string }> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);

    if (order.fulfillmentStatus !== 'FULFILLED' && order.fulfillmentStatus !== 'PARTIALLY_FULFILLED') {
      throw new InvalidOrderStateError(
        `order ${cmd.orderPublicId} is ${order.fulfillmentStatus.toLowerCase()} — nothing has been fulfilled yet to return`,
      );
    }

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

    const created = await this.orders.createReturn({ orderId: order.id, reason: cmd.reason, lines, refundTo: cmd.refundTo ?? null });

    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'RETURN_CREATED',
      message: `Return requested (${lines.length} line(s)): ${cmd.reason}`,
      actorType: cmd.actorType ?? 'ADMIN',
    });

    return { publicId: created.publicId };
  }
}

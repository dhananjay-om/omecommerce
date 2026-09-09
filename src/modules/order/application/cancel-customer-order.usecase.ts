import type { OrderRepository, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CancelOrder } from './cancel-order.usecase.js';
import type { OrderViewDto } from './dto.js';

/** Customer-facing counterpart to CancelOrder — ownership-checked (same
 *  pattern as GetCustomerOrder: resolve the caller's internal customerId,
 *  reject if the order isn't theirs with a plain 404, never a 403 that
 *  would confirm the order exists), then delegates entirely to the
 *  existing, already-proven CancelOrder usecase for the actual eligibility
 *  guard + refund + restock — no second cancellation engine. Records the
 *  order's timeline entry as CUSTOMER, not ADMIN. */
export class CancelCustomerOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly customers: CustomerLookup,
    private readonly cancelOrder: CancelOrder,
  ) {}

  async execute(
    customerPublicId: string,
    orderPublicId: string,
    input: { reason?: string; refundTo?: 'ORIGINAL_PAYMENT_METHOD' | 'WALLET' },
  ): Promise<OrderViewDto> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);

    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order || order.customerId !== customerId) throw new NotFoundError('Order', orderPublicId);

    return this.cancelOrder.execute({
      orderPublicId,
      reason: input.reason,
      refundTo: input.refundTo,
      actorType: 'CUSTOMER',
    });
  }
}

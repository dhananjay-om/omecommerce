import type { OrderRepository, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CreateReturn } from './create-return.usecase.js';

/** Customer-facing counterpart to CreateReturn — ownership-checked (same
 *  pattern as GetCustomerOrder/CancelCustomerOrder), then delegates
 *  entirely to the existing CreateReturn usecase — no second write path.
 *  This only ever creates a REQUESTED return; it still goes through the
 *  same admin-moderated Approve -> Receive -> Refund pipeline as an
 *  admin-logged one (see UpdateReturnStatus/RefundReturn's own doc
 *  comments) — a customer's own request doesn't skip that, it just gets
 *  the goods-received check the pipeline exists for. Records the order's
 *  timeline entry as CUSTOMER, not ADMIN. */
export class CreateCustomerReturn {
  constructor(
    private readonly orders: OrderRepository,
    private readonly customers: CustomerLookup,
    private readonly createReturn: CreateReturn,
  ) {}

  async execute(
    customerPublicId: string,
    orderPublicId: string,
    input: {
      reason: string;
      lines: Array<{ sku: string; qty: number; restock?: boolean }>;
      refundTo?: 'ORIGINAL_PAYMENT_METHOD' | 'WALLET';
    },
  ): Promise<{ publicId: string }> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);

    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order || order.customerId !== customerId) throw new NotFoundError('Order', orderPublicId);

    return this.createReturn.execute({
      orderPublicId,
      reason: input.reason,
      lines: input.lines,
      refundTo: input.refundTo,
      actorType: 'CUSTOMER',
    });
  }
}

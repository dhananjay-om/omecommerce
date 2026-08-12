import type { OrderRepository, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

/**
 * plan/15 Phase 11 — the customer-facing counterpart to GetOrder: same
 * mapping, but ownership-checked (unlike the pre-existing unauthenticated
 * `GET /store/v1/orders/:publicId`, which returns any order to anyone who
 * knows its publicId — a real gap this route does not repeat) and strips
 * INTERNAL notes (admin-only, never meant to reach a customer).
 */
export class GetCustomerOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(customerPublicId: string, orderPublicId: string): Promise<OrderViewDto> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);

    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order || order.customerId !== customerId) throw new NotFoundError('Order', orderPublicId);

    const dto = toOrderDto(order);
    return { ...dto, notes: dto.notes.filter((n) => n.type === 'CUSTOMER') };
  }
}

import type { OrderRepository, CustomerLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderTrackingDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

const TRACKING_EVENT_TYPES = new Set(['SHIPMENT_CREATED', 'TRACKING_ADDED']);

/** plan/15 Phase 11/13 — carrier/tracking detail + a shipment-scoped history (not the full admin timeline, and admin actor identity is never exposed to a customer). Ownership-checked. */
export class GetCustomerOrderTracking {
  constructor(
    private readonly orders: OrderRepository,
    private readonly customers: CustomerLookup,
  ) {}

  async execute(customerPublicId: string, orderPublicId: string): Promise<OrderTrackingDto> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);

    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order || order.customerId !== customerId) throw new NotFoundError('Order', orderPublicId);

    const history = await this.orders.listHistory(order.id);
    const dto = toOrderDto(order);

    return {
      fulfillments: dto.fulfillments,
      history: history
        .filter((h) => TRACKING_EVENT_TYPES.has(h.eventType))
        .map((h) => ({
          id: h.id.toString(),
          eventType: h.eventType,
          fromValue: h.fromValue,
          toValue: h.toValue,
          message: h.message,
          actorType: h.actorType,
          actorName: h.actorType === 'ADMIN' ? null : h.actorName,
          createdAt: h.createdAt.toISOString(),
        })),
    };
  }
}

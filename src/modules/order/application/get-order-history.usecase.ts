import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderHistoryDto } from './dto.js';

/** plan/15 Phase 0b — the order timeline, a separate read from GetOrder's main detail payload (a long-lived order's history can grow much larger than everything else on the page combined). */
export class GetOrderHistory {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderPublicId: string): Promise<OrderHistoryDto[]> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    const rows = await this.orders.listHistory(order.id);
    return rows.map((r) => ({
      id: r.id.toString(),
      eventType: r.eventType,
      fromValue: r.fromValue,
      toValue: r.toValue,
      message: r.message,
      actorType: r.actorType,
      actorName: r.actorName,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

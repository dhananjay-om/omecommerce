import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderEmailLogDto } from './dto.js';

export class GetEmailLog {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderPublicId: string): Promise<OrderEmailLogDto[]> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    const rows = await this.orders.listEmailLog(order.id);
    return rows.map((r) => ({
      id: r.id.toString(),
      emailType: r.emailType,
      toEmail: r.toEmail,
      subject: r.subject,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

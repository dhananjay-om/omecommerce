import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderInvoiceDto } from './dto.js';
import { toInvoiceDto } from './get-order.usecase.js';

export class ListInvoices {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderPublicId: string): Promise<OrderInvoiceDto[]> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    return order.invoices.map((inv) => toInvoiceDto(order, inv));
  }
}

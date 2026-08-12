import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderInvoiceDto } from './dto.js';
import { toInvoiceDto } from './get-order.usecase.js';

export class GetInvoice {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderPublicId: string, invoicePublicId: string): Promise<OrderInvoiceDto> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    const invoice = order.invoices.find((inv) => inv.publicId === invoicePublicId);
    if (!invoice) throw new NotFoundError('Invoice', invoicePublicId);
    return toInvoiceDto(order, invoice);
  }
}

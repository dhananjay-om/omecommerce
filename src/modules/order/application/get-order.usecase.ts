import type { OrderRepository, OrderView } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderViewDto } from './dto.js';

export function toOrderDto(order: OrderView): OrderViewDto {
  return {
    publicId: order.publicId,
    orderNumber: order.orderNumber,
    email: order.email,
    currency: order.currency,
    status: order.status,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotal: order.subtotal,
    taxTotal: order.taxTotal,
    shippingTotal: order.shippingTotal,
    grandTotal: order.grandTotal,
    lines: order.lines.map((l) => ({
      sku: l.sku,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      taxAmount: l.taxAmount,
      rowTotal: l.rowTotal,
      fulfilledQty: l.fulfilledQty,
      refundedQty: l.refundedQty,
    })),
  };
}

export class GetOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderPublicId: string): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    return toOrderDto(order);
  }
}

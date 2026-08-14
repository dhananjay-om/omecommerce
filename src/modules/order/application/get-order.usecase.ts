import type { OrderRepository, OrderView, OrderInvoiceView } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OrderViewDto, OrderInvoiceDto } from './dto.js';

export function toInvoiceDto(order: OrderView, invoice: OrderInvoiceView): OrderInvoiceDto {
  return {
    publicId: invoice.publicId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    grandTotal: invoice.grandTotal,
    createdAt: invoice.createdAt.toISOString(),
    lines: invoice.lines.map((l) => {
      const orderLine = order.lines.find((ol) => ol.id === l.orderLineId);
      return { sku: orderLine?.sku ?? l.orderLineId.toString(), qty: l.qty, unitPrice: l.unitPrice, taxAmount: l.taxAmount, rowTotal: l.rowTotal };
    }),
  };
}

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
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    shippingTotal: order.shippingTotal,
    grandTotal: order.grandTotal,
    shippingMethodCode: order.shippingMethodCode,
    couponCode: order.couponCode,
    customerIp: order.customerIp,
    placedAt: order.placedAt.toISOString(),
    closedAt: order.closedAt ? order.closedAt.toISOString() : null,
    lines: order.lines.map((l) => ({
      sku: l.sku,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      taxAmount: l.taxAmount,
      discountAmount: l.discountAmount,
      rowTotal: l.rowTotal,
      taxClassCode: l.taxClassCode,
      hsnCode: l.hsnCode,
      fulfilledQty: l.fulfilledQty,
      refundedQty: l.refundedQty,
    })),
    addresses: order.addresses.map((a) => ({
      type: a.type,
      name: a.name,
      company: a.company,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      region: a.region,
      stateCode: a.stateCode,
      gstin: a.gstin,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone,
    })),
    taxLines: order.taxLines.map((t) => ({
      taxClassCode: t.taxClassCode,
      taxType: t.taxType,
      rate: t.rate,
      amount: t.amount,
    })),
    payments: order.payments.map((p) => ({
      method: p.method,
      gateway: p.gateway,
      type: p.type,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      gatewayRef: p.gatewayRef,
      createdAt: p.createdAt.toISOString(),
    })),
    fulfillments: order.fulfillments.map((f) => ({
      publicId: f.publicId,
      status: f.status,
      trackingNumber: f.trackingNumber,
      carrier: f.carrier,
      carrierTrackingUrl: f.carrierTrackingUrl,
      estimatedDeliveryAt: f.estimatedDeliveryAt ? f.estimatedDeliveryAt.toISOString() : null,
      currentStatus: f.currentStatus,
      shippingNotes: f.shippingNotes,
      hasPackingSlip: f.packingSlipStorageKey !== null,
      shippedAt: f.shippedAt ? f.shippedAt.toISOString() : null,
      createdAt: f.createdAt.toISOString(),
      lines: f.lines.map((l) => {
        const orderLine = order.lines.find((ol) => ol.id === l.orderLineId);
        return { sku: orderLine?.sku ?? l.orderLineId.toString(), qty: l.qty };
      }),
    })),
    returns: order.returns.map((r) => ({
      publicId: r.publicId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      lines: r.lines.map((l) => {
        const orderLine = order.lines.find((ol) => ol.id === l.orderLineId);
        return { sku: orderLine?.sku ?? l.orderLineId.toString(), qty: l.qty, restock: l.restock };
      }),
    })),
    notes: order.notes.map((n) => ({ id: n.id.toString(), type: n.type, body: n.body, createdAt: n.createdAt.toISOString() })),
    invoices: order.invoices.map((inv) => toInvoiceDto(order, inv)),
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

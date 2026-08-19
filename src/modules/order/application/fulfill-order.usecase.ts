import type { OrderRepository, WarehouseResolver } from '../domain/repositories.js';
import type { PdfRenderer, PdfStorage } from '../domain/ports.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import { buildPackingSlipHtml } from '../infrastructure/packing-slip-template.js';
import type { FulfillOrderCommand, OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

export class FulfillOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly warehouses: WarehouseResolver,
    private readonly outbox: OutboxWriter,
    private readonly pdfRenderer: PdfRenderer,
    private readonly pdfStorage: PdfStorage,
  ) {}

  async execute(cmd: FulfillOrderCommand): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);
    // ON_ACCOUNT (plan/15 Phase 7) ships now, pays later — the whole point
    // of Net-X credit terms — so it's fulfillable exactly like PAID.
    if (order.financialStatus !== 'PAID' && order.financialStatus !== 'ON_ACCOUNT') {
      throw new InvalidOrderStateError(`order ${cmd.orderPublicId} is not paid — cannot fulfill`);
    }

    const warehouse = await this.warehouses.resolveForStore(order.storeId);
    if (!warehouse) throw new NotFoundError('Warehouse', 'no warehouse available for this order');

    const fulfillmentLines: Array<{ orderLineId: bigint; qty: number }> = [];
    for (const requested of cmd.lines) {
      const line = order.lines.find((l) => l.sku === requested.sku);
      if (!line) throw new NotFoundError('OrderLine', requested.sku);
      await this.orders.incrementFulfilledQty(line.id, requested.qty);
      fulfillmentLines.push({ orderLineId: line.id, qty: requested.qty });
    }

    const fulfillment = await this.orders.createFulfillment({
      orderId: order.id,
      warehouseId: warehouse.id,
      status: 'SHIPPED',
      trackingNumber: cmd.trackingNumber ?? null,
      carrier: cmd.carrier ?? null,
      carrierTrackingUrl: cmd.carrierTrackingUrl ?? null,
      estimatedDeliveryAt: cmd.estimatedDeliveryAt ? new Date(cmd.estimatedDeliveryAt) : null,
      shippingNotes: cmd.shippingNotes ?? null,
      lines: fulfillmentLines,
    });

    const updated = await this.orders.findByPublicId(cmd.orderPublicId);
    const allFulfilled = updated!.lines.every((l) => l.fulfilledQty >= l.qty);
    const anyFulfilled = updated!.lines.some((l) => l.fulfilledQty > 0);
    const newFulfillmentStatus = allFulfilled ? 'FULFILLED' : anyFulfilled ? 'PARTIALLY_FULFILLED' : 'UNFULFILLED';
    await this.orders.setFulfillmentStatus(order.id, newFulfillmentStatus);

    const createdFulfillment = updated!.fulfillments.find((f) => f.publicId === fulfillment.publicId)!;
    const packingSlipHtml = buildPackingSlipHtml(updated!, createdFulfillment);
    const packingSlipPdf = await this.pdfRenderer.render(packingSlipHtml);
    const packingSlipKey = `packing-slips/${order.publicId}/${fulfillment.publicId}.pdf`;
    await this.pdfStorage.store(packingSlipKey, packingSlipPdf);
    await this.orders.setPackingSlipKey(fulfillment.id, packingSlipKey);

    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'Shipped',
      payload: { orderNumber: order.orderNumber, fulfillmentPublicId: fulfillment.publicId, trackingNumber: cmd.trackingNumber ?? null },
    });
    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'SHIPMENT_CREATED',
      fromValue: order.fulfillmentStatus,
      toValue: newFulfillmentStatus,
      message: cmd.trackingNumber ? `Shipment created (tracking: ${cmd.trackingNumber})` : 'Shipment created',
      actorType: 'ADMIN',
    });

    const final = await this.orders.findByPublicId(cmd.orderPublicId);
    return toOrderDto(final!);
  }
}

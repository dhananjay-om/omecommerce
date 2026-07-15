import type { OrderRepository, VariantLookup, WarehouseResolver } from '../domain/repositories.js';
import type { StockLedger } from '../../inventory/domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import { addMinor, toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { RefundOrderCommand, OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

const REFUNDABLE_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED']);

export class RefundOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly ledger: StockLedger,
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseResolver,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: RefundOrderCommand): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);
    if (!REFUNDABLE_STATUSES.has(order.financialStatus)) {
      throw new InvalidOrderStateError(`order ${cmd.orderPublicId} is not refundable (status ${order.financialStatus})`);
    }

    const restock = cmd.restock ?? true;
    let refundTotalMinor = 0n;

    for (const requested of cmd.lines) {
      const line = order.lines.find((l) => l.sku === requested.sku);
      if (!line) throw new NotFoundError('OrderLine', requested.sku);

      // Proportional refund: unit price * qty, plus a proportional share of the
      // line's snapshotted tax (BigInt division truncates — documented rounding
      // rule, same as shared/domain/decimal.ts applyRate).
      const unitPriceMinor = toMinorUnits(line.unitPrice);
      const lineTaxMinor = toMinorUnits(line.taxAmount);
      const refundAmountMinor = unitPriceMinor * BigInt(requested.qty) + (lineTaxMinor * BigInt(requested.qty)) / BigInt(line.qty);
      refundTotalMinor = addMinor(refundTotalMinor, refundAmountMinor);

      await this.orders.incrementRefundedQty(line.id, requested.qty);

      if (restock) {
        const variant = await this.variants.byId(line.variantId);
        if (!variant) continue;
        const warehouse =
          (await this.warehouses.resolveForOrderLine(line.id)) ?? (await this.warehouses.resolveForStore(order.storeId));
        if (!warehouse) continue;
        const stockItem = await this.ledger.getOrCreateStockItem(line.variantId, warehouse.id);
        await this.ledger.adjust(stockItem.id, requested.qty, 'RETURN', { note: `refund on order ${order.publicId}` });
      }
    }

    // Payment refund is simulated via the same test gateway used at checkout;
    // in production this calls the real gateway's refund API with the original
    // charge's gatewayRef.
    const gatewayRef = `test_refund_${order.publicId}_${Date.now()}`;
    await this.orders.recordPayment({
      orderId: order.id,
      method: 'original',
      gateway: 'test',
      type: 'REFUND',
      amountMinor: refundTotalMinor,
      currency: order.currency,
      status: 'SUCCEEDED',
      gatewayRef,
    });

    const updated = await this.orders.findByPublicId(cmd.orderPublicId);
    const allRefunded = updated!.lines.every((l) => l.refundedQty >= l.qty);
    await this.orders.setFinancialStatus(order.id, allRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED');
    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'OrderRefunded',
      payload: { orderNumber: order.orderNumber, amount: fromMinorUnits(refundTotalMinor), restocked: restock },
    });

    const final = await this.orders.findByPublicId(cmd.orderPublicId);
    return toOrderDto(final!);
  }
}

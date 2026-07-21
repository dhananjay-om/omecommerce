import type { OrderRepository, VariantLookup, WarehouseResolver, CustomerLookup } from '../domain/repositories.js';
import type { StockLedger } from '../../inventory/domain/repositories.js';
import type { CreditWallet } from '../../wallet/application/credit-wallet.usecase.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import { addMinor, toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { RefundOrderCommand, OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

const REFUNDABLE_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED']);

/**
 * Refund destination (plan/15 Phase 0e): the wallet module's ledger already
 * supports crediting a customer (source: 'REFUND', bucket: 'STORE_CREDIT') —
 * it was simply never called from here. CreditWallet is imported directly
 * (not a per-module lookup copy) because it's a money-moving ledger write,
 * the same "correctness-critical shared logic" carve-out already applied to
 * StockLedger/PriceResolver in this module.
 */
export class RefundOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly ledger: StockLedger,
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseResolver,
    private readonly outbox: OutboxWriter,
    private readonly customers: CustomerLookup,
    private readonly creditWallet: CreditWallet,
  ) {}

  async execute(cmd: RefundOrderCommand): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);
    if (!REFUNDABLE_STATUSES.has(order.financialStatus)) {
      throw new InvalidOrderStateError(`order ${cmd.orderPublicId} is not refundable (status ${order.financialStatus})`);
    }

    const refundTo = cmd.refundTo ?? 'ORIGINAL_PAYMENT_METHOD';
    let customerPublicId: string | null = null;
    if (refundTo === 'WALLET') {
      if (!order.customerId) {
        throw new ValidationError('cannot refund to wallet', [{ path: 'refundTo', message: 'order has no customer (guest checkout) — use ORIGINAL_PAYMENT_METHOD' }]);
      }
      customerPublicId = await this.customers.findPublicIdById(order.customerId);
      if (!customerPublicId) throw new NotFoundError('customer', order.customerId.toString());
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

    if (refundTo === 'WALLET') {
      await this.creditWallet.execute({
        customerPublicId: customerPublicId!,
        amount: fromMinorUnits(refundTotalMinor),
        bucket: 'STORE_CREDIT',
        source: 'REFUND',
        reason: `Refund for order ${order.orderNumber}`,
      });
      await this.orders.recordPayment({
        orderId: order.id,
        method: 'wallet',
        gateway: 'wallet',
        type: 'REFUND',
        amountMinor: refundTotalMinor,
        currency: order.currency,
        status: 'SUCCEEDED',
        gatewayRef: `wallet_credit_${order.publicId}_${Date.now()}`,
      });
    } else {
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
    }

    const updated = await this.orders.findByPublicId(cmd.orderPublicId);
    const allRefunded = updated!.lines.every((l) => l.refundedQty >= l.qty);
    const newFinancialStatus = allRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await this.orders.setFinancialStatus(order.id, newFinancialStatus);
    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'OrderRefunded',
      payload: { orderNumber: order.orderNumber, amount: fromMinorUnits(refundTotalMinor), restocked: restock, refundTo },
    });
    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'REFUNDED',
      fromValue: order.financialStatus,
      toValue: newFinancialStatus,
      message: `Refunded ${order.currency} ${fromMinorUnits(refundTotalMinor)} to ${refundTo === 'WALLET' ? 'store credit' : 'original payment method'}${restock ? ' (restocked)' : ''}`,
      actorType: 'ADMIN',
    });

    const final = await this.orders.findByPublicId(cmd.orderPublicId);
    return toOrderDto(final!);
  }
}

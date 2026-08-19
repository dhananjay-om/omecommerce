import type { OrderRepository, VariantLookup, WarehouseResolver, CustomerLookup } from '../domain/repositories.js';
import type { StockLedger } from '../../inventory/domain/repositories.js';
import type { CreditWallet } from '../../wallet/application/credit-wallet.usecase.js';
import type { WalletLedger } from '../../wallet/domain/repositories.js';
import type { GiftCardLedger } from '../../giftcard/domain/repositories.js';
import type { CompanyCreditLedger } from '../../company/domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import { addMinor, subtractMinor, toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { RefundOrderCommand, OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

// ON_ACCOUNT (plan/15 Phase 7) is refundable — CancelOrder relies on this to
// reverse an unsettled credit-terms charge (see refundToOriginalTenders's
// own doc comment on exactly what's and isn't handled once an on-account
// order has already been settled).
const REFUNDABLE_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED', 'ON_ACCOUNT']);

/** One slice of a split-tender refund, before it's actually credited. */
interface FundingSlice {
  kind: 'WALLET' | 'GIFT_CARD' | 'CREDIT_TERMS' | 'PSP';
  /** How much of the order's grandTotal this source originally funded. */
  originalMinor: bigint;
  walletId?: bigint;
  giftCardId?: bigint;
  creditAccountId?: bigint;
}

/**
 * Refund destination (plan/15 Phase 0e, extended Phase 5 for split tender):
 * the wallet module's ledger already supports crediting a customer (source:
 * 'REFUND', bucket: 'STORE_CREDIT') — it was simply never called from here.
 * CreditWallet/WalletLedger/GiftCardLedger are imported directly (not
 * per-module lookup copies) because they're money-moving ledger writes, the
 * same "correctness-critical shared logic" carve-out already applied to
 * StockLedger/PriceResolver in this module.
 *
 * Split-tender routing (Phase 5): `refundTo: 'WALLET'` is an explicit
 * override — the entire refund goes to wallet regardless of how the order
 * was originally funded, unchanged from Phase 0e's behavior. The default,
 * `'ORIGINAL_PAYMENT_METHOD'`, now means "split proportionally by how the
 * order was actually funded" — for the common case (100% PSP, no
 * StoredValueHold captured against this order's cart) that reduces to
 * exactly the old 100%-to-PSP behavior. A captured StoredValueHold is found
 * by its permanent `refType: 'CART', refId: order.cartId` — holds are never
 * re-pointed at the Order once created (see StoredValueHold's own doc
 * comment), so this is the one place that fact is relied on outside
 * checkout itself.
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
    private readonly wallets: WalletLedger,
    private readonly giftCards: GiftCardLedger,
    private readonly companyCredit: CompanyCreditLedger,
  ) {}

  async execute(cmd: RefundOrderCommand): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);
    if (!REFUNDABLE_STATUSES.has(order.financialStatus)) {
      throw new InvalidOrderStateError(`order ${cmd.orderPublicId} is not refundable (status ${order.financialStatus})`);
    }

    const refundTo = cmd.refundTo ?? 'ORIGINAL_PAYMENT_METHOD';
    if (refundTo === 'WALLET' && !order.customerId) {
      throw new ValidationError('cannot refund to wallet', [{ path: 'refundTo', message: 'order has no customer (guest checkout) — use ORIGINAL_PAYMENT_METHOD' }]);
    }
    // Resolved whenever the order has a customer, not just for the explicit
    // WALLET override — a split-tender refund's wallet share (below) needs
    // it too, and it's cheap to resolve unconditionally rather than
    // threading a second lazy-resolve path through the split loop.
    let customerPublicId: string | null = null;
    if (order.customerId) {
      customerPublicId = await this.customers.findPublicIdById(order.customerId);
      if (!customerPublicId) throw new NotFoundError('customer', order.customerId.toString());
    }

    const restock = cmd.restock ?? true;
    let refundTotalMinor = 0n;

    for (const requested of cmd.lines) {
      const line = order.lines.find((l) => l.sku === requested.sku);
      if (!line) throw new NotFoundError('OrderLine', requested.sku);

      // Proportional refund: unit price * qty, plus a proportional share of the
      // line's snapshotted tax, minus a proportional share of any coupon
      // discount this line received (BigInt division truncates — documented
      // rounding rule, same as shared/domain/decimal.ts applyRate). Without the
      // discount subtraction, a customer who used a coupon and later got a
      // partial refund would be refunded MORE than they actually paid for
      // those units — a real pre-existing bug, fixed alongside the coupon
      // item-targeting work that finally makes OrderLine.discountAmount non-zero.
      const unitPriceMinor = toMinorUnits(line.unitPrice);
      const lineTaxMinor = toMinorUnits(line.taxAmount);
      const lineDiscountMinor = toMinorUnits(line.discountAmount);
      const refundAmountMinor =
        unitPriceMinor * BigInt(requested.qty) +
        (lineTaxMinor * BigInt(requested.qty)) / BigInt(line.qty) -
        (lineDiscountMinor * BigInt(requested.qty)) / BigInt(line.qty);
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
      // Explicit override — entire refund to wallet regardless of original
      // tender, unchanged Phase 0e behavior.
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
      await this.refundToOriginalTenders(order, refundTotalMinor, customerPublicId);
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

  /**
   * Splits `refundTotalMinor` proportionally across whatever actually funded
   * this order (plan/15 Phase 5) — any CAPTURED StoredValueHold against the
   * order's originating cart, plus whatever the PSP was charged for the
   * remainder. For a 100%-PSP order (no captured holds — every order before
   * this phase, and the common case after it) this reduces to exactly the
   * pre-Phase-5 100%-to-PSP behavior: `sources` has one PSP entry and the
   * loop below credits it in full. The LAST source absorbs the BigInt
   * floor-division rounding remainder, so the slices always sum to exactly
   * `refundTotalMinor` — and when there's no real PSP portion (a fully
   * tender-funded order), that remainder correctly lands on a stored-value
   * source instead of inventing a phantom PSP refund.
   *
   * plan/15 Phase 7 — a credit-terms CHARGE is only added as a funding
   * source while the order is STILL ON_ACCOUNT (never settled). CancelOrder
   * is the intended caller for that case (nothing shipped yet, so it's
   * always unsettled) and correctly reverses the charge, reducing what's
   * owed. Deliberately NOT handled: refunding an order that was already
   * settled via RecordCompanyCreditPayment (financialStatus flipped to
   * PAID) — its credit-terms portion is, by then, real money the merchant
   * already collected off-platform (check/wire), which this module has no
   * way to route a refund back through; that portion falls through to the
   * PSP bucket below instead, same known simplification as every other
   * "which original tender" edge case in this codebase.
   */
  private async refundToOriginalTenders(
    order: { id: bigint; publicId: string; orderNumber: string; currency: string; cartId: bigint | null; grandTotal: string; financialStatus: string },
    refundTotalMinor: bigint,
    customerPublicId: string | null,
  ): Promise<void> {
    const walletHolds = order.cartId ? await this.wallets.findCapturedHoldsByRef('CART', order.cartId) : [];
    const giftCardHolds = order.cartId ? await this.giftCards.findCapturedHoldsByRef('CART', order.cartId) : [];
    const creditCharge =
      order.cartId && order.financialStatus === 'ON_ACCOUNT' ? await this.companyCredit.findChargeByRef('CART', order.cartId) : null;

    const sources: FundingSlice[] = [
      ...walletHolds.map((h) => ({ kind: 'WALLET' as const, originalMinor: toMinorUnits(h.amount), walletId: h.walletId })),
      ...giftCardHolds.map((h) => ({ kind: 'GIFT_CARD' as const, originalMinor: toMinorUnits(h.amount), giftCardId: h.giftCardId })),
      ...(creditCharge
        ? [{ kind: 'CREDIT_TERMS' as const, originalMinor: toMinorUnits(creditCharge.amount), creditAccountId: creditCharge.accountId }]
        : []),
    ];
    const grandTotalMinor = toMinorUnits(order.grandTotal);
    const tenderedMinor = addMinor(...sources.map((s) => s.originalMinor));
    const pspOriginalMinor = grandTotalMinor > 0n ? subtractMinor(grandTotalMinor, tenderedMinor) : 0n;
    if (pspOriginalMinor > 0n) sources.push({ kind: 'PSP', originalMinor: pspOriginalMinor });

    // No sources at all only happens if grandTotal is 0 (never in practice —
    // guarded defensively rather than dividing by zero below).
    if (sources.length === 0 || grandTotalMinor <= 0n) return;

    let allocatedMinor = 0n;
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]!;
      const isLast = i === sources.length - 1;
      const shareMinor = isLast ? subtractMinor(refundTotalMinor, allocatedMinor) : (refundTotalMinor * source.originalMinor) / grandTotalMinor;
      allocatedMinor = addMinor(allocatedMinor, shareMinor);
      if (shareMinor <= 0n) continue;

      if (source.kind === 'WALLET') {
        await this.creditWallet.execute({
          customerPublicId: customerPublicId!,
          amount: fromMinorUnits(shareMinor),
          bucket: 'STORE_CREDIT',
          source: 'REFUND',
          reason: `Refund for order ${order.orderNumber}`,
        });
        await this.orders.recordPayment({
          orderId: order.id,
          method: 'wallet',
          gateway: 'wallet',
          type: 'REFUND',
          amountMinor: shareMinor,
          currency: order.currency,
          status: 'SUCCEEDED',
          gatewayRef: `wallet_credit_${order.publicId}_${Date.now()}`,
        });
      } else if (source.kind === 'GIFT_CARD') {
        await this.giftCards.refundCredit(source.giftCardId!, fromMinorUnits(shareMinor), {
          refType: 'ORDER',
          refId: order.id,
          reason: `Refund for order ${order.orderNumber}`,
        });
        await this.orders.recordPayment({
          orderId: order.id,
          method: 'giftcard',
          gateway: 'giftcard',
          type: 'REFUND',
          amountMinor: shareMinor,
          currency: order.currency,
          status: 'SUCCEEDED',
          // Suffixed with the gift card's own id (not just a timestamp) — a
          // split refund can credit several distinct gift cards in the same
          // loop tick, and Date.now() alone isn't guaranteed to differ
          // between them.
          gatewayRef: `giftcard_credit_${order.publicId}_${source.giftCardId}_${Date.now()}`,
        });
      } else if (source.kind === 'CREDIT_TERMS') {
        // Reverses the charge (reduces what's owed) rather than crediting
        // anything — no cash ever changed hands for an unsettled on-account
        // charge, so there's nothing to "refund," only debt to forgive. Same
        // CART ref as the original charge for traceability (see this
        // method's own doc comment on why CompanyCreditTransaction refs
        // never point at the Order).
        await this.companyCredit.reverseCharge(source.creditAccountId!, fromMinorUnits(shareMinor), {
          refType: 'CART',
          refId: order.cartId!,
          reason: `Refund/cancellation for order ${order.orderNumber}`,
        });
        await this.orders.recordPayment({
          orderId: order.id,
          method: 'credit_terms',
          gateway: 'credit_terms',
          type: 'REFUND',
          amountMinor: shareMinor,
          currency: order.currency,
          status: 'SUCCEEDED',
          gatewayRef: null,
        });
      } else {
        // Payment refund is simulated via the same test gateway used at
        // checkout; in production this calls the real gateway's refund API
        // with the original charge's gatewayRef.
        await this.orders.recordPayment({
          orderId: order.id,
          method: 'original',
          gateway: 'test',
          type: 'REFUND',
          amountMinor: shareMinor,
          currency: order.currency,
          status: 'SUCCEEDED',
          gatewayRef: `test_refund_${order.publicId}_${Date.now()}`,
        });
      }
    }
  }
}

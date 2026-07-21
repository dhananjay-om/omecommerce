import type { CartRepository, OrderRepository, VariantLookup, WarehouseResolver } from '../domain/repositories.js';
import type { TaxCalculator, ShippingCalculator, PaymentGateway } from '../domain/ports.js';
import type { StoreContextResolver, StoreViewContext } from '../../../shared/application/scope.js';
import type { PriceResolver } from '../../pricing/domain/repositories.js';
import type { StockLedger, ReservationHandle } from '../../inventory/domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { PaymentDeclinedError } from '../domain/errors.js';
import { addMinor, multiplyByQty, toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { CompleteCheckoutCommand, OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

interface PricedLine {
  variantId: bigint;
  qty: number;
  unitPriceMinor: bigint;
  subtotalMinor: bigint;
}

/**
 * The checkout saga (plan/08 §3). Sequence, matching the plan text precisely:
 *   1. Claim the cart (guarded ACTIVE -> CONVERTED; prevents double-checkout races)
 *   2. Resolve prices live, per unit (never trust stale cart totals — plan/05 §2.3)
 *   3. RESERVE inventory per line (soft hold; on ANY failure, release everything
 *      already reserved and abort — the compensating rollback)
 *   4. Compute tax + shipping, create the Order + snapshots (financialStatus=PENDING)
 *   5. Attempt payment capture
 *        - success -> COMMIT reservations (on_hand deducted), financialStatus=PAID
 *        - failure -> RELEASE reservations (stock never left), order CANCELLED
 * Payment and inventory commit are deliberately NOT one DB transaction — this is a
 * saga with explicit compensation, not a single ACID unit (plan/08 §3).
 *
 * NOTE on cross-module reuse: StockLedger (inventory) and PriceResolver (pricing)
 * are imported directly rather than re-implemented, unlike the trivial per-module
 * lookups (VariantLookup, WarehouseResolver) that every module duplicates. Both
 * encode a correctness-critical invariant (race-safe reservation; tier-vs-base
 * price resolution) that must have exactly one implementation — duplicating them
 * would risk the two copies silently drifting apart.
 */
export class CompleteCheckout {
  constructor(
    private readonly carts: CartRepository,
    private readonly orders: OrderRepository,
    private readonly variants: VariantLookup,
    private readonly storeContext: StoreContextResolver,
    private readonly priceResolver: PriceResolver,
    private readonly ledger: StockLedger,
    private readonly warehouses: WarehouseResolver,
    private readonly taxCalculator: TaxCalculator,
    private readonly shippingCalculator: ShippingCalculator,
    private readonly paymentGateway: PaymentGateway,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: CompleteCheckoutCommand): Promise<OrderViewDto> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);
    if (cart.lines.length === 0) {
      throw new ValidationError('cart is empty', [{ path: 'cart', message: 'must have at least one line' }]);
    }

    const ctx = await this.storeContext.byStoreViewId(cart.storeViewId);
    if (!ctx) throw new NotFoundError('StoreView', cart.storeViewId.toString());

    const warehouse = await this.warehouses.resolveForStore(ctx.storeId);
    if (!warehouse) throw new NotFoundError('Warehouse', 'no warehouse available for this store');

    // Step 1: claim the cart atomically before any expensive work.
    await this.carts.claimForCheckout(cart.id);

    // Step 2: resolve live per-unit prices for every line.
    const pricedLines: PricedLine[] = [];
    for (const line of cart.lines) {
      const resolved = await this.priceResolver.resolve({
        variantId: line.variantId,
        qty: line.qty,
        currency: cart.currency,
        customerGroupId: cart.customerGroupId,
        websiteId: ctx.websiteId,
        asOf: new Date(),
      });
      if (!resolved) {
        throw new NotFoundError('Price', `no price configured for variant ${line.variantId}`);
      }
      const unitPriceMinor = toMinorUnits(resolved.price);
      pricedLines.push({
        variantId: line.variantId,
        qty: line.qty,
        unitPriceMinor,
        subtotalMinor: multiplyByQty(unitPriceMinor, line.qty),
      });
    }

    // Step 3: reserve inventory per line; on any failure, release everything
    // reserved so far and abort (the saga's compensating rollback).
    const reservations: ReservationHandle[] = [];
    try {
      for (const line of pricedLines) {
        const stockItem = await this.ledger.getOrCreateStockItem(line.variantId, warehouse.id);
        reservations.push(await this.ledger.reserve(stockItem.id, line.qty, 'CART', cart.id));
      }
    } catch (err) {
      await this.releaseAll(reservations);
      throw err;
    }

    try {
      return await this.priceAndPlace(cmd, cart, ctx, pricedLines, reservations);
    } catch (err) {
      await this.releaseAll(reservations);
      throw err;
    }
  }

  private async priceAndPlace(
    cmd: CompleteCheckoutCommand,
    cart: { id: bigint; currency: string; customerId: bigint | null; customerGroupId: bigint | null },
    ctx: StoreViewContext,
    pricedLines: PricedLine[],
    reservations: ReservationHandle[],
  ): Promise<OrderViewDto> {
    const subtotalMinor = addMinor(...pricedLines.map((l) => l.subtotalMinor));

    const taxResults = await this.taxCalculator.calculate(
      pricedLines.map((l) => ({ variantId: l.variantId, lineSubtotalMinor: l.subtotalMinor })),
    );
    const taxByVariant = new Map(taxResults.map((t) => [t.variantId.toString(), t]));
    const taxTotalMinor = addMinor(...taxResults.map((t) => t.amountMinor));

    const shipping = await this.shippingCalculator.quote(cmd.shippingMethodCode, cart.currency);
    if (!shipping) throw new NotFoundError('ShippingMethod', cmd.shippingMethodCode);

    const grandTotalMinor = addMinor(subtotalMinor, taxTotalMinor, shipping.amountMinor);

    const lines = [];
    for (const line of pricedLines) {
      const variant = await this.variants.byId(line.variantId);
      if (!variant) throw new NotFoundError('ProductVariant', line.variantId.toString());
      const tax = taxByVariant.get(line.variantId.toString())!;
      lines.push({
        variantId: line.variantId,
        sku: variant.sku,
        name: variant.nameDefault ?? variant.sku,
        qty: line.qty,
        unitPriceMinor: line.unitPriceMinor,
        taxAmountMinor: tax.amountMinor,
        rowTotalMinor: addMinor(line.subtotalMinor, tax.amountMinor),
        taxClassCode: tax.taxClassCode,
      });
    }

    const taxLinesByClass = new Map<string, { rateMinor: bigint; amountMinor: bigint }>();
    for (const t of taxResults) {
      if (!t.taxClassCode) continue;
      const existing = taxLinesByClass.get(t.taxClassCode);
      taxLinesByClass.set(t.taxClassCode, {
        rateMinor: t.rateMinor,
        amountMinor: (existing?.amountMinor ?? 0n) + t.amountMinor,
      });
    }

    const orderNumber = await this.orders.nextOrderNumber(ctx.websiteId);

    // Step 4: create the order + snapshots (financialStatus defaults PENDING).
    const order = await this.orders.create(
      {
        cartId: cart.id,
        websiteId: ctx.websiteId,
        storeId: ctx.storeId,
        storeViewId: ctx.storeViewId,
        customerId: cart.customerId,
        customerGroupId: cart.customerGroupId,
        email: cmd.email,
        currency: cart.currency,
        customerIp: cmd.customerIp,
        subtotalMinor,
        taxTotalMinor,
        shippingTotalMinor: shipping.amountMinor,
        grandTotalMinor,
        shippingMethodCode: shipping.methodCode,
        lines,
        addresses: [
          { type: 'BILLING', ...cmd.billingAddress },
          { type: 'SHIPPING', ...cmd.shippingAddress },
        ],
        taxLines: Array.from(taxLinesByClass.entries()).map(([taxClassCode, v]) => ({
          taxClassCode,
          rateMinor: v.rateMinor,
          amountMinor: v.amountMinor,
        })),
      },
      orderNumber,
    );

    // Step 5: attempt payment.
    const payment = await this.paymentGateway.capture({
      orderId: order.id,
      amountMinor: grandTotalMinor,
      currency: cart.currency,
      method: cmd.paymentMethod,
      testScenario: cmd.testScenario,
    });

    await this.orders.recordPayment({
      orderId: order.id,
      method: cmd.paymentMethod,
      gateway: 'test',
      type: 'CAPTURE',
      amountMinor: grandTotalMinor,
      currency: cart.currency,
      status: payment.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
      gatewayRef: payment.gatewayRef,
      raw: payment.raw,
    });

    if (payment.status === 'SUCCEEDED') {
      for (const reservation of reservations) {
        await this.ledger.commitReservation(reservation.publicId);
      }
      await this.orders.setFinancialStatus(order.id, 'PAID');
      await this.orders.setOrderStatus(order.id, 'PROCESSING');
      await this.outbox.write({
        aggregateType: 'Order',
        aggregateId: order.publicId,
        eventType: 'OrderPaid',
        payload: { orderNumber: order.orderNumber, grandTotal: fromMinorUnits(grandTotalMinor) },
      });
      await this.orders.recordHistory({
        orderId: order.id,
        eventType: 'PAYMENT_RECEIVED',
        fromValue: 'PENDING',
        toValue: 'PAID',
        message: `Payment captured via ${cmd.paymentMethod}`,
        actorType: 'SYSTEM',
      });
    } else {
      await this.releaseAll(reservations);
      await this.orders.setOrderStatus(order.id, 'CANCELLED');
      // FAILED (plan/15 Phase 0a) over leaving financialStatus at its PENDING
      // default — a payment-declined order previously looked indistinguishable
      // from "checkout never even attempted payment yet."
      await this.orders.setFinancialStatus(order.id, 'FAILED');
      await this.outbox.write({
        aggregateType: 'Order',
        aggregateId: order.publicId,
        eventType: 'OrderPaymentFailed',
        payload: { orderNumber: order.orderNumber, gatewayRef: payment.gatewayRef },
      });
      await this.orders.recordHistory({
        orderId: order.id,
        eventType: 'PAYMENT_FAILED',
        fromValue: 'PENDING',
        toValue: 'FAILED',
        message: `Payment declined (gateway ref ${payment.gatewayRef})`,
        actorType: 'SYSTEM',
      });
      throw new PaymentDeclinedError(order.publicId, payment.gatewayRef);
    }

    const finalOrder = await this.orders.findByPublicId(order.publicId);
    return toOrderDto(finalOrder!);
  }

  private async releaseAll(reservations: ReservationHandle[]): Promise<void> {
    for (const r of reservations) {
      await this.ledger.releaseReservation(r.publicId).catch(() => undefined);
    }
  }
}

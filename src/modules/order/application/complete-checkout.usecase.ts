import type {
  CartRepository,
  OrderRepository,
  VariantLookup,
  WarehouseResolver,
  CartTenderView,
  CompanyMembershipLookup,
  WalletSettingsLookup,
} from '../domain/repositories.js';
import {
  walletBlockReason,
  walletCapMinor,
  UNRESTRICTED_WALLET_SETTINGS,
} from '../domain/wallet-rules.js';
import type { TaxCalculator, ShippingCalculator, PaymentGateway } from '../domain/ports.js';
import type { StoreContextResolver, StoreViewContext } from '../../../shared/application/scope.js';
import type { PriceResolver } from '../../pricing/domain/repositories.js';
import type { StockLedger, ReservationHandle } from '../../inventory/domain/repositories.js';
import type { DiscountCalculator } from '../../coupon/domain/repositories.js';
import type {
  WalletLedger,
  StoredValueHoldHandle as WalletHoldHandle,
} from '../../wallet/domain/repositories.js';
import type {
  GiftCardLedger,
  StoredValueHoldHandle as GiftCardHoldHandle,
} from '../../giftcard/domain/repositories.js';
import type { CompanyCreditLedger } from '../../company/domain/repositories.js';
import { InsufficientAvailableBalanceError } from '../../wallet/domain/errors.js';
import { InsufficientAvailableGiftCardBalanceError } from '../../giftcard/domain/errors.js';
import { CreditLimitExceededError } from '../../company/domain/errors.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { PaymentDeclinedError } from '../domain/errors.js';
import {
  addMinor,
  subtractMinor,
  multiplyByQty,
  toMinorUnits,
  fromMinorUnits,
} from '../../../shared/domain/decimal.js';
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
 * One placed stored-value hold, tagged with which ledger placed it (so
 * capture/release routes to the right one). CREDIT_TERMS is deliberately
 * NOT a two-phase hold (plan/15 Phase 7) — charge()'s guarded UPDATE is
 * itself atomic and already-real the moment it succeeds, so this entry only
 * carries what's needed to record a payment-transaction row on success or
 * call reverseCharge() on failure, mirroring the other two tenders' shape
 * closely enough to share the same array/loop.
 */
type TenderHold =
  | { tenderType: 'WALLET'; hold: WalletHoldHandle }
  | { tenderType: 'GIFT_CARD'; hold: GiftCardHoldHandle }
  | { tenderType: 'CREDIT_TERMS'; creditAccountId: bigint; amountMinor: bigint };

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
    private readonly discountCalculator: DiscountCalculator,
    private readonly wallets: WalletLedger,
    private readonly giftCards: GiftCardLedger,
    private readonly companyMemberships: CompanyMembershipLookup,
    private readonly companyCredit: CompanyCreditLedger,
    private readonly walletSettings: WalletSettingsLookup,
  ) {}

  async execute(cmd: CompleteCheckoutCommand): Promise<OrderViewDto> {
    const cart = await this.carts.findByPublicId(cmd.cartPublicId);
    if (!cart) throw new NotFoundError('Cart', cmd.cartPublicId);
    if (cart.lines.length === 0) {
      throw new ValidationError('cart is empty', [
        { path: 'cart', message: 'must have at least one line' },
      ]);
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

    // Stored-value holds (plan/15 Phase 5) — placed inside priceAndPlace,
    // once grandTotalMinor is known, but declared here so this same outer
    // catch releases them symmetrically with inventory on ANY failure from
    // that point on (order creation, coupon race, payment decline).
    const holds: TenderHold[] = [];
    try {
      return await this.priceAndPlace(cmd, cart, ctx, pricedLines, reservations, holds);
    } catch (err) {
      await this.releaseAll(reservations);
      await this.releaseAllHolds(holds);
      throw err;
    }
  }

  private async priceAndPlace(
    cmd: CompleteCheckoutCommand,
    cart: {
      id: bigint;
      currency: string;
      customerId: bigint | null;
      customerGroupId: bigint | null;
      couponCode: string | null;
      tenders: CartTenderView[];
    },
    ctx: StoreViewContext,
    pricedLines: PricedLine[],
    reservations: ReservationHandle[],
    holds: TenderHold[],
  ): Promise<OrderViewDto> {
    // GST split (CGST+SGST vs IGST) depends on the shipping state vs this
    // website's registered origin state — resolved inside the calculator
    // (NativeGstTaxCalculator), this call site only has to supply both state
    // codes, not the comparison itself. Called FIRST, before subtotal/discount
    // are computed: when this website's catalog prices are tax-inclusive
    // (Website.pricesIncludeTax), each result's taxableAmountMinor is the
    // REAL line subtotal (tax backed out of the catalog price) — computing
    // subtotal from the raw catalog price first would double-count tax once
    // it's added to grandTotal below. When prices are tax-exclusive (default,
    // unchanged from before this setting existed), taxableAmountMinor is
    // just the input subtotal passed straight through.
    // plan/15 Phase 6 — resolved FRESH here (not inherited from Cart, unlike
    // customerGroupId below) so a company's tax-exemption status is always
    // current as of checkout time; snapshotted onto the Order below so a
    // LATER company change never retroactively alters this placed order.
    const companyMembership = cart.customerId
      ? await this.companyMemberships.findActiveByCustomerId(cart.customerId)
      : null;
    const taxExempt = companyMembership?.taxExempt ?? false;

    const taxResults = await this.taxCalculator.calculate(
      pricedLines.map((l) => ({ variantId: l.variantId, lineSubtotalMinor: l.subtotalMinor })),
      {
        websiteId: ctx.websiteId,
        destinationStateCode: cmd.shippingAddress.stateCode ?? null,
        taxExempt,
      },
    );
    const taxByVariant = new Map(taxResults.map((t) => [t.variantId.toString(), t]));
    const taxTotalMinor = addMinor(...taxResults.map((t) => t.amountMinor));

    // Corrected lines: subtotalMinor becomes each line's real (always
    // tax-exclusive) taxable base per taxByVariant above. unitPriceMinor is
    // re-derived from it for display only — not summed into any total
    // (rowTotalMinor below is subtotal+tax directly) — so a qty>1 line's
    // floor-division remainder here is a cosmetic display approximation,
    // never a money-correctness issue.
    const correctedLines: PricedLine[] = pricedLines.map((l) => {
      const tax = taxByVariant.get(l.variantId.toString())!;
      return {
        ...l,
        subtotalMinor: tax.taxableAmountMinor,
        unitPriceMinor: tax.taxableAmountMinor / BigInt(l.qty),
      };
    });
    const subtotalMinor = addMinor(...correctedLines.map((l) => l.subtotalMinor));

    // Resolved once, up front — needed both for the coupon's per-line context
    // (productId per line) and for building OrderLine inputs below, so the
    // lines-building loop further down reuses this map instead of re-querying.
    const variantById = new Map<
      string,
      { sku: string; nameDefault: string | null; productId: bigint; hsnCode: string | null }
    >();
    for (const line of correctedLines) {
      const variant = await this.variants.byId(line.variantId);
      if (!variant) throw new NotFoundError('ProductVariant', line.variantId.toString());
      variantById.set(line.variantId.toString(), variant);
    }
    const discountLines = correctedLines.map((l) => ({
      variantId: l.variantId,
      productId: variantById.get(l.variantId.toString())!.productId,
      subtotalMinor: l.subtotalMinor,
    }));

    // Coupon evaluated (not redeemed) here — redemption is guarded and only
    // happens once the order actually exists, right before payment capture (see
    // below). Tax is intentionally computed on the PRE-discount subtotal — see
    // coupon.prisma's header comment on this deliberate simplification. A
    // manually-entered code always wins; only when the cart has none do we look
    // for an auto-apply coupon (never persisted onto Cart — always recomputed live).
    const isAutoApplied = !cart.couponCode;
    const discount = cart.couponCode
      ? await this.discountCalculator.evaluate({
          code: cart.couponCode,
          cartCurrency: cart.currency,
          lines: discountLines,
          customerId: cart.customerId,
          asOf: new Date(),
        })
      : await this.discountCalculator.findBestAutoApply({
          cartCurrency: cart.currency,
          lines: discountLines,
          customerId: cart.customerId,
          asOf: new Date(),
        });
    const discountTotalMinor = discount?.discountAmountMinor ?? 0n;
    const discountByVariant = new Map(
      (discount?.lineDiscounts ?? []).map((d) => [d.variantId.toString(), d.discountAmountMinor]),
    );

    const shipping = await this.shippingCalculator.quote(cmd.shippingMethodCode, cart.currency);
    if (!shipping) throw new NotFoundError('ShippingMethod', cmd.shippingMethodCode);

    let grandTotalMinor = addMinor(
      subtotalMinor,
      taxTotalMinor,
      shipping.amountMinor,
      -discountTotalMinor,
    );

    // Step 4.5: resolve cart tenders live and place real holds, each capped
    // at what's still due — gift cards drain first (in application order),
    // then wallet (plan/15 Phase 5), then credit terms LAST (plan/15 Phase
    // 7 — the entire reason Phase 5 had to come first: this slots into the
    // same resolution loop as its final tender). Mirrors step 3's
    // inventory-reserve loop exactly: any failure here releases/reverses
    // everything already placed (via the outer catch in execute(), which
    // now also calls releaseAllHolds). Order creation happens AFTER this so
    // a failed hold never needs an order to roll back — same ordering
    // reasoning as inventory reservation happening before order creation.
    let remainingMinor = grandTotalMinor;
    // Read once per checkout, outside the loop — a website lookup miss falls
    // back to "no restrictions" rather than ever being the reason checkout
    // itself breaks (plan/17).
    const walletRules =
      (await this.walletSettings.byId(ctx.websiteId)) ?? UNRESTRICTED_WALLET_SETTINGS;
    const TENDER_PRIORITY: Record<CartTenderView['tenderType'], number> = {
      GIFT_CARD: 0,
      WALLET: 1,
      CREDIT_TERMS: 2,
    };
    const sortedTenders = [...cart.tenders].sort((a, b) => {
      if (a.tenderType !== b.tenderType)
        return TENDER_PRIORITY[a.tenderType] - TENDER_PRIORITY[b.tenderType];
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    for (const tender of sortedTenders) {
      if (remainingMinor <= 0n) break;
      if (tender.tenderType === 'GIFT_CARD') {
        const giftCard = await this.giftCards.findById(tender.giftCardId!);
        if (!giftCard || giftCard.currency !== cart.currency || giftCard.status !== 'ACTIVE')
          continue;
        const availableMinor = subtractMinor(
          toMinorUnits(giftCard.balance),
          toMinorUnits(giftCard.heldBalance),
        );
        if (availableMinor <= 0n) continue;
        const holdMinor = availableMinor < remainingMinor ? availableMinor : remainingMinor;
        try {
          // The guarded UPDATE inside hold() is what's actually race-safe —
          // `availableMinor` above is only a snapshot, so a concurrent
          // checkout against this SAME gift card can shrink the real
          // available balance between that read and this call. Losing that
          // race isn't a checkout failure: same "gracefully degrade, don't
          // abort" philosophy as the auto-applied-coupon race below —
          // this tender just contributes nothing and the PSP covers more.
          const hold = await this.giftCards.hold(
            giftCard.id,
            fromMinorUnits(holdMinor),
            'CART',
            cart.id,
          );
          holds.push({ tenderType: 'GIFT_CARD', hold });
          remainingMinor = subtractMinor(remainingMinor, holdMinor);
        } catch (err) {
          if (!(err instanceof InsufficientAvailableGiftCardBalanceError)) throw err;
        }
      } else if (tender.tenderType === 'WALLET') {
        if (!cart.customerId) continue; // apply-wallet already requires a customer, but stay defensive
        // Store-wide disable / below-minimum-order-value (plan/17) — same
        // "not applying is silent, checkout still succeeds via another
        // tender" philosophy as insufficient balance, not a hard failure.
        if (walletBlockReason(grandTotalMinor, walletRules)) continue;
        const wallet = await this.wallets.getOrCreateWallet(
          cart.customerId,
          ctx.websiteId,
          cart.currency,
        );
        const snapshot = await this.wallets.findByPublicId(wallet.publicId);
        if (!snapshot || snapshot.status !== 'ACTIVE') continue;
        const availableMinor = subtractMinor(
          toMinorUnits(snapshot.balance),
          toMinorUnits(snapshot.heldBalance),
        );
        if (availableMinor <= 0n) continue;
        let holdMinor = availableMinor < remainingMinor ? availableMinor : remainingMinor;
        const capMinor = walletCapMinor(grandTotalMinor, walletRules);
        if (capMinor < holdMinor) holdMinor = capMinor;
        if (holdMinor <= 0n) continue;
        try {
          // Same race-loss-degrades-gracefully reasoning as the gift-card
          // branch above — concurrent checkouts against the same wallet are
          // exactly the case this guards (proven by a 10-concurrent-checkout
          // integration test).
          const hold = await this.wallets.hold(
            wallet.id,
            fromMinorUnits(holdMinor),
            'CART',
            cart.id,
          );
          holds.push({ tenderType: 'WALLET', hold });
          remainingMinor = subtractMinor(remainingMinor, holdMinor);
        } catch (err) {
          if (!(err instanceof InsufficientAvailableBalanceError)) throw err;
        }
      } else {
        // CREDIT_TERMS (plan/15 Phase 7) — a single atomic guarded charge,
        // not a two-phase hold (see TenderHold's own doc comment on why).
        // companyMembership was already resolved above for taxExempt; reused
        // here rather than re-querying membership a second time.
        if (!cart.customerId || !companyMembership?.creditAccountId) continue;
        const account = await this.companyCredit.findById(companyMembership.creditAccountId);
        if (!account || account.status !== 'ACTIVE' || account.currency !== cart.currency) continue;
        const availableMinor = subtractMinor(
          toMinorUnits(account.creditLimit),
          toMinorUnits(account.outstanding),
        );
        if (availableMinor <= 0n) continue;
        const chargeMinor = availableMinor < remainingMinor ? availableMinor : remainingMinor;
        try {
          // Same race-loss-degrades-gracefully reasoning as gift-card/wallet
          // above — `availableMinor` is only a snapshot, charge()'s own
          // guarded UPDATE is what's actually race-safe against concurrent
          // checkouts drawing on the same credit limit (the 10-concurrent
          // proof this phase's integration test repeats for the third time).
          await this.companyCredit.charge(account.id, fromMinorUnits(chargeMinor), {
            refType: 'CART',
            refId: cart.id,
          });
          holds.push({
            tenderType: 'CREDIT_TERMS',
            creditAccountId: account.id,
            amountMinor: chargeMinor,
          });
          remainingMinor = subtractMinor(remainingMinor, chargeMinor);
        } catch (err) {
          if (!(err instanceof CreditLimitExceededError)) throw err;
        }
      }
    }

    // Zero-due orders (fully covered by stored-value tenders) skip the PSP
    // entirely — paymentMethod is only required when something is still due.
    if (remainingMinor > 0n && !cmd.paymentMethod) {
      throw new ValidationError('paymentMethod is required', [
        {
          path: 'paymentMethod',
          message: `required — ${fromMinorUnits(remainingMinor)} ${cart.currency} is still due after applied tenders`,
        },
      ]);
    }

    const lines = [];
    for (const line of correctedLines) {
      const variant = variantById.get(line.variantId.toString())!;
      const tax = taxByVariant.get(line.variantId.toString())!;
      lines.push({
        variantId: line.variantId,
        sku: variant.sku,
        name: variant.nameDefault ?? variant.sku,
        qty: line.qty,
        unitPriceMinor: line.unitPriceMinor,
        taxAmountMinor: tax.amountMinor,
        discountAmountMinor: discountByVariant.get(line.variantId.toString()) ?? 0n,
        rowTotalMinor: addMinor(line.subtotalMinor, tax.amountMinor),
        taxClassCode: tax.taxClassCode,
        hsnCode: variant.hsnCode,
      });
    }

    // Grouped by (taxClassCode, taxType) — not just taxClassCode — so an
    // intra-state order writes 2 OrderTaxLine rows per class (CGST + SGST,
    // each half the rate) and an inter-state one writes 1 (IGST, full rate).
    const taxLinesByClass = new Map<
      string,
      {
        taxClassCode: string;
        taxType: 'CGST' | 'SGST' | 'IGST';
        rateMinor: bigint;
        amountMinor: bigint;
      }
    >();
    for (const t of taxResults) {
      if (!t.taxClassCode) continue;
      for (const b of t.breakdown) {
        const key = `${t.taxClassCode}:${b.type}`;
        const existing = taxLinesByClass.get(key);
        taxLinesByClass.set(key, {
          taxClassCode: t.taxClassCode,
          taxType: b.type,
          rateMinor: b.rateMinor,
          amountMinor: (existing?.amountMinor ?? 0n) + b.amountMinor,
        });
      }
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
        companyId: companyMembership?.companyId ?? null,
        taxExempt,
        poNumber: cmd.poNumber ?? null,
        email: cmd.email,
        currency: cart.currency,
        customerIp: cmd.customerIp,
        subtotalMinor,
        discountTotalMinor,
        taxTotalMinor,
        shippingTotalMinor: shipping.amountMinor,
        grandTotalMinor,
        shippingMethodCode: shipping.methodCode,
        couponCode: discount?.code ?? null,
        lines,
        addresses: [
          { type: 'BILLING', ...cmd.billingAddress },
          { type: 'SHIPPING', ...cmd.shippingAddress },
        ],
        taxLines: Array.from(taxLinesByClass.values()).map((v) => ({
          taxClassCode: v.taxClassCode,
          taxType: v.taxType,
          rateMinor: v.rateMinor,
          amountMinor: v.amountMinor,
        })),
      },
      orderNumber,
    );

    // Coupon usage is only committed once the order actually exists — the guarded
    // usage-count UPDATE inside redeem() is the authoritative race guard (evaluate()/
    // findBestAutoApply() above were only an optimistic pre-check).
    if (discount) {
      try {
        await this.discountCalculator.redeem({
          couponId: discount.couponId,
          orderId: order.id,
          customerId: cart.customerId,
          currency: cart.currency,
          discountAmountMinor: discount.discountAmountMinor,
        });
      } catch (err) {
        if (!isAutoApplied) {
          // A manually-entered code losing the race (limit hit by a concurrent
          // checkout in between) propagates to execute()'s existing
          // catch { releaseAll(reservations); throw }, rejecting this checkout
          // before payment is ever attempted — the customer explicitly chose
          // this code, so this is the one case that should hard-fail.
          throw err;
        }
        // An auto-applied coupon losing the same race is invisible to the
        // customer — they never chose it — so revert the discount already
        // baked into the just-created order/lines and proceed to charge full
        // price, rather than aborting the whole checkout (releasing inventory,
        // declining payment) over a discount nobody explicitly asked for.
        const reverted = await this.orders.revertDiscount(order.id);
        grandTotalMinor = reverted.grandTotalMinor;
        // revertDiscount() adds discount_total back onto the order's grand_total (exactly
        // discount.discountAmountMinor, the same value that shrank grandTotalMinor when
        // remainingMinor was first computed above) — without bumping remainingMinor by the
        // same amount here, the PSP charge below stays at the pre-revert (discounted) amount
        // while the order now reflects full price, silently undercharging the customer.
        remainingMinor = addMinor(remainingMinor, discount.discountAmountMinor);
      }
    }

    // Step 5: attempt payment for whatever's still due after tenders — zero
    // due (fully tender-settled) skips the PSP entirely, matching a
    // guest-checkout-style "nothing to charge" outcome (plan/15 Phase 5).
    const payment =
      remainingMinor > 0n
        ? await this.paymentGateway.capture({
            orderId: order.id,
            amountMinor: remainingMinor,
            currency: cart.currency,
            method: cmd.paymentMethod!,
            testScenario: cmd.testScenario,
          })
        : { status: 'SUCCEEDED' as const, gatewayRef: null, raw: undefined };

    if (remainingMinor > 0n) {
      await this.orders.recordPayment({
        orderId: order.id,
        method: cmd.paymentMethod!,
        gateway: 'test',
        type: 'CAPTURE',
        amountMinor: remainingMinor,
        currency: cart.currency,
        status: payment.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
        gatewayRef: payment.gatewayRef,
        raw: payment.raw,
      });
    }

    if (payment.status === 'SUCCEEDED') {
      for (const reservation of reservations) {
        await this.ledger.commitReservation(reservation.publicId);
      }
      // Capture every hold — writes the real ledger DEBIT/REDEEM row — and
      // records one PaymentTransaction per tender, same shape as the PSP
      // capture above (method 'wallet'/'giftcard'/'credit_terms', gatewayRef
      // = the hold's own publicId so a refund can trace straight back to
      // it — CREDIT_TERMS has no such handle since it was never a two-phase
      // hold, so gatewayRef is null there; nothing else needs a "capture"
      // call, the guarded charge() already moved the real ledger balance
      // when it was applied above).
      let usedCreditTerms = false;
      for (const h of holds) {
        if (h.tenderType === 'GIFT_CARD') {
          await this.giftCards.captureHold(h.hold.publicId);
          await this.orders.recordPayment({
            orderId: order.id,
            method: 'giftcard',
            gateway: 'giftcard',
            type: 'CAPTURE',
            amountMinor: toMinorUnits(h.hold.amount),
            currency: cart.currency,
            status: 'SUCCEEDED',
            gatewayRef: h.hold.publicId,
          });
        } else if (h.tenderType === 'WALLET') {
          await this.wallets.captureHold(h.hold.publicId);
          await this.orders.recordPayment({
            orderId: order.id,
            method: 'wallet',
            gateway: 'wallet',
            type: 'CAPTURE',
            amountMinor: toMinorUnits(h.hold.amount),
            currency: cart.currency,
            status: 'SUCCEEDED',
            gatewayRef: h.hold.publicId,
          });
        } else {
          usedCreditTerms = true;
          await this.orders.recordPayment({
            orderId: order.id,
            method: 'credit_terms',
            gateway: 'credit_terms',
            type: 'CAPTURE',
            amountMinor: h.amountMinor,
            currency: cart.currency,
            status: 'SUCCEEDED',
            gatewayRef: null,
          });
        }
      }
      // plan/15 Phase 7 — an order funded (even partially) by credit terms
      // becomes ON_ACCOUNT, not PAID, and OrderPaid is deliberately NOT fired
      // here: firing it now would wrongly trigger loyalty earning/referral
      // qualification for money not yet actually collected. It becomes PAID
      // — and only then fires OrderPaid — once RecordCompanyCreditPayment
      // settles the receivable.
      if (usedCreditTerms) {
        await this.orders.setFinancialStatus(order.id, 'ON_ACCOUNT');
        await this.orders.setOrderStatus(order.id, 'PROCESSING');
        await this.orders.recordHistory({
          orderId: order.id,
          eventType: 'PAYMENT_RECEIVED',
          fromValue: 'PENDING',
          toValue: 'ON_ACCOUNT',
          message: 'Order placed on account — awaiting settlement of the credit-terms portion',
          actorType: 'SYSTEM',
        });
      } else {
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
          message:
            remainingMinor > 0n
              ? `Payment captured via ${cmd.paymentMethod}`
              : 'Payment fully covered by wallet/gift card tenders',
          actorType: 'SYSTEM',
        });
      }
    } else {
      await this.releaseAll(reservations);
      await this.releaseAllHolds(holds);
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

  private async releaseAllHolds(holds: TenderHold[]): Promise<void> {
    for (const h of holds) {
      if (h.tenderType === 'GIFT_CARD') {
        await this.giftCards.releaseHold(h.hold.publicId).catch(() => undefined);
      } else if (h.tenderType === 'WALLET') {
        await this.wallets.releaseHold(h.hold.publicId).catch(() => undefined);
      } else {
        // reverseCharge() never throws (see its own "unguarded" contract),
        // but caught defensively anyway for symmetry with the other two.
        await this.companyCredit
          .reverseCharge(h.creditAccountId, fromMinorUnits(h.amountMinor))
          .catch(() => undefined);
      }
    }
  }
}

import type { VariantLookup, CartProductMediaLookup, CartLineView, WebsiteTaxConfigLookup, TaxClassLookup } from '../domain/repositories.js';
import type { MediaUrlResolver } from '../domain/ports.js';
import type { PriceResolver } from '../../pricing/domain/repositories.js';
import type { DiscountCalculator, DiscountLineInput } from '../../coupon/domain/repositories.js';
import { DomainError } from '../../../shared/domain/errors.js';
import { addMinor, subtractMinor, multiplyByQty, applyRate, extractTaxExclusive, toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';
import type { CartLineDto, CartView } from './dto.js';

interface EnrichableCart {
  publicId: string;
  currency: string;
  websiteId: bigint;
  customerId: bigint | null;
  customerGroupId: bigint | null;
  status: string;
  couponCode: string | null;
  lines: CartLineView[];
}

type VariantRef = { sku: string; nameDefault: string | null; productId: bigint } | null;

/**
 * Resolves each cart line's display fields (name/sku/price/image) plus the
 * cart's subtotal, fresh on every read (plan/14 Phase 5a) — a real gap found
 * building the storefront cart page: lines carried only {id, variantId, qty},
 * nothing a cart UI could actually render. Composes the same read-only
 * lookups CompleteCheckout already uses for price (never trust a stale cart
 * total — checkout re-resolves independently regardless of what this
 * returns), plus a new own-copy media lookup for the line thumbnail.
 */
export class EnrichCartView {
  constructor(
    private readonly variants: VariantLookup,
    private readonly priceResolver: PriceResolver,
    private readonly productMedia: CartProductMediaLookup,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly discountCalculator: DiscountCalculator,
    private readonly websiteTaxConfig: WebsiteTaxConfigLookup,
    private readonly taxClasses: TaxClassLookup,
  ) {}

  async execute(cart: EnrichableCart): Promise<CartView> {
    // Resolved once, up front — every downstream step (line display, coupon
    // per-line context) needs the variant, so this avoids re-querying it twice
    // per line the way evaluating a coupon separately would.
    const variantRefs = await Promise.all(cart.lines.map((line) => this.variants.byId(line.variantId)));
    const lines: CartLineDto[] = await Promise.all(cart.lines.map((line, i) => this.enrichLine(line, cart, variantRefs[i]!)));

    // Not frozen at cart creation — see CartView.pricesIncludeTax's doc comment.
    const websiteTaxConfig = await this.websiteTaxConfig.byId(cart.websiteId);
    const pricesIncludeTax = websiteTaxConfig?.pricesIncludeTax ?? false;

    const priced = lines.map((l) => l.lineTotal).filter((v): v is string => v !== null);
    const subtotal = priced.length > 0 ? fromMinorUnits(addMinor(...priced.map(toMinorUnits))) : null;

    // An estimate shown pre-checkout (cart/checkout pages, before a shipping
    // state is known) — the CGST+SGST-vs-IGST split needs the destination
    // state, but the total tax AMOUNT doesn't: 18% is 18% whether it's shown
    // as 9%+9% or a flat 18%, only the label differs. So this is already the
    // real number, just without the final split/labels checkout will show.
    // Same pre-discount-subtotal basis the real order-level calculation uses
    // (see complete-checkout.usecase.ts's comment on that).
    let taxTotalMinor: bigint | null = null;
    if (priced.length > 0) {
      const perLineTax = await Promise.all(
        cart.lines.map(async (line, i) => {
          const lineTotal = lines[i]!.lineTotal;
          if (lineTotal === null) return 0n;
          const taxClass = await this.taxClasses.byVariantId(line.variantId);
          if (!taxClass) return 0n;
          const lineTotalMinor = toMinorUnits(lineTotal);
          return pricesIncludeTax ? extractTaxExclusive(lineTotalMinor, taxClass.rateMinor).taxMinor : applyRate(lineTotalMinor, taxClass.rateMinor);
        }),
      );
      taxTotalMinor = addMinor(...perLineTax);
    }
    const taxTotal = taxTotalMinor !== null ? fromMinorUnits(taxTotalMinor) : null;

    const discountLines: DiscountLineInput[] = [];
    for (let i = 0; i < cart.lines.length; i++) {
      const variant = variantRefs[i];
      const lineTotal = lines[i]!.lineTotal;
      // Unpriced or unresolved lines are excluded from coupon math too — same
      // exclusion `subtotal` above already applies.
      if (!variant || lineTotal === null) continue;
      discountLines.push({ variantId: cart.lines[i]!.variantId, productId: variant.productId, subtotalMinor: toMinorUnits(lineTotal) });
    }

    let couponCode = cart.couponCode;
    let couponIsAutoApplied = false;
    let discountTotal: string | null = null;
    let couponError: string | null = null;
    const lineDiscountByVariant = new Map<string, bigint>();

    if (cart.couponCode && subtotal !== null) {
      try {
        const evaluation = await this.discountCalculator.evaluate({
          code: cart.couponCode,
          cartCurrency: cart.currency,
          lines: discountLines,
          customerId: cart.customerId,
          asOf: new Date(),
        });
        discountTotal = fromMinorUnits(evaluation.discountAmountMinor);
        for (const d of evaluation.lineDiscounts) lineDiscountByVariant.set(d.variantId.toString(), d.discountAmountMinor);
      } catch (err) {
        // A coupon that's since become invalid (expired, hit its usage limit, an
        // admin deactivated it) must never break a plain cart read — surface it
        // as couponError instead. Checkout re-validates for real and hard-fails.
        couponError = err instanceof DomainError ? err.message : 'coupon is no longer valid';
      }
    } else if (subtotal !== null) {
      // No manually-entered code — look for an auto-apply coupon, live, same as
      // checkout does. Never persisted onto Cart; a since-changed cart or a
      // newly-created/expired coupon can legitimately show a different result
      // on the next read, same "always recomputed live" philosophy as the
      // discount amount itself has always had.
      const evaluation = await this.discountCalculator.findBestAutoApply({
        cartCurrency: cart.currency,
        lines: discountLines,
        customerId: cart.customerId,
        asOf: new Date(),
      });
      if (evaluation) {
        couponCode = evaluation.code;
        couponIsAutoApplied = true;
        discountTotal = fromMinorUnits(evaluation.discountAmountMinor);
        for (const d of evaluation.lineDiscounts) lineDiscountByVariant.set(d.variantId.toString(), d.discountAmountMinor);
      }
    }

    // Exclusive: tax isn't inside subtotal yet, so it's added on top, same as
    // grandTotal = subtotal + tax - discount at real checkout (minus shipping,
    // not yet known here). Inclusive: tax is already inside subtotal — adding
    // it again would double-count, so the formula is unchanged from before
    // this estimate existed.
    let estimatedTotal = subtotal;
    if (estimatedTotal !== null && discountTotal !== null) {
      estimatedTotal = fromMinorUnits(subtractMinor(toMinorUnits(estimatedTotal), toMinorUnits(discountTotal)));
    }
    if (estimatedTotal !== null && !pricesIncludeTax && taxTotal !== null) {
      estimatedTotal = fromMinorUnits(addMinor(toMinorUnits(estimatedTotal), toMinorUnits(taxTotal)));
    }

    const linesWithDiscount = lines.map((l, i) => {
      const amount = lineDiscountByVariant.get(cart.lines[i]!.variantId.toString());
      return { ...l, discountAmount: amount !== undefined ? fromMinorUnits(amount) : null };
    });

    return {
      publicId: cart.publicId,
      currency: cart.currency,
      status: cart.status,
      lines: linesWithDiscount,
      subtotal,
      couponCode,
      couponIsAutoApplied,
      discountTotal,
      couponError,
      estimatedTotal,
      pricesIncludeTax,
      taxTotal,
    };
  }

  private async enrichLine(line: CartLineView, cart: EnrichableCart, variant: VariantRef): Promise<CartLineDto> {
    const [resolvedPrice, imageKey] = await Promise.all([
      this.priceResolver.resolve({
        variantId: line.variantId,
        qty: line.qty,
        currency: cart.currency,
        customerGroupId: cart.customerGroupId,
        websiteId: cart.websiteId,
        asOf: new Date(),
      }),
      variant ? this.productMedia.primaryImageKey(variant.productId) : Promise.resolve(null),
    ]);

    const price = resolvedPrice?.price ?? null;
    const lineTotal = price !== null ? fromMinorUnits(multiplyByQty(toMinorUnits(price), line.qty)) : null;
    const imageUrl = imageKey ? await this.mediaUrls.presignGetUrl(imageKey) : null;

    return {
      id: line.id.toString(),
      variantId: line.variantPublicId,
      qty: line.qty,
      sku: variant?.sku ?? line.variantPublicId,
      name: variant?.nameDefault ?? variant?.sku ?? line.variantPublicId,
      price,
      imageUrl,
      lineTotal,
      discountAmount: null, // filled in by execute() once the coupon evaluation is known
    };
  }
}

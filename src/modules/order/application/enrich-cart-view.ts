import type {
  VariantLookup,
  CartProductMediaLookup,
  CartLineView,
  WebsiteTaxConfigLookup,
  TaxClassLookup,
  CartTenderView,
  CustomerGroupLookup,
  CompanyMembershipLookup,
  WalletSettingsLookup,
} from '../domain/repositories.js';
import type { MediaUrlResolver } from '../domain/ports.js';
import type { PriceResolver } from '../../pricing/domain/repositories.js';
import type { DiscountCalculator, DiscountLineInput } from '../../coupon/domain/repositories.js';
import type { WalletLedger } from '../../wallet/domain/repositories.js';
import type { GiftCardLedger } from '../../giftcard/domain/repositories.js';
import type { CompanyCreditLedger } from '../../company/domain/repositories.js';
import { DomainError } from '../../../shared/domain/errors.js';
import {
  addMinor,
  subtractMinor,
  multiplyByQty,
  applyRate,
  extractTaxExclusive,
  toMinorUnits,
  fromMinorUnits,
} from '../../../shared/domain/decimal.js';
import {
  walletBlockReason,
  walletCapMinor,
  UNRESTRICTED_WALLET_SETTINGS,
  type WalletSettings,
} from '../domain/wallet-rules.js';
import type { CartLineDto, CartView, CartTenderDto } from './dto.js';

/** null when there's no priced total yet — can't evaluate a minimum order value against
 *  nothing, and there's nothing to pay for regardless; a store-wide disable short-circuits
 *  before any total is needed either way. */
function computeWalletUnavailableReason(
  estimatedTotal: string | null,
  rules: WalletSettings,
): string | null {
  if (!rules.walletEnabled) return walletBlockReason(0n, rules);
  if (estimatedTotal === null) return null;
  return walletBlockReason(toMinorUnits(estimatedTotal), rules);
}

interface EnrichableCart {
  publicId: string;
  currency: string;
  websiteId: bigint;
  customerId: bigint | null;
  customerGroupId: bigint | null;
  status: string;
  couponCode: string | null;
  lines: CartLineView[];
  tenders: CartTenderView[];
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
    private readonly wallets: WalletLedger,
    private readonly giftCards: GiftCardLedger,
    private readonly customerGroups: CustomerGroupLookup,
    private readonly companyCredit: CompanyCreditLedger,
    private readonly companyMemberships: CompanyMembershipLookup,
    private readonly walletSettings: WalletSettingsLookup,
  ) {}

  async execute(cart: EnrichableCart): Promise<CartView> {
    // Resolved once, up front — every downstream step (line display, coupon
    // per-line context) needs the variant, so this avoids re-querying it twice
    // per line the way evaluating a coupon separately would.
    const variantRefs = await Promise.all(
      cart.lines.map((line) => this.variants.byId(line.variantId)),
    );
    const lines: CartLineDto[] = await Promise.all(
      cart.lines.map((line, i) => this.enrichLine(line, cart, variantRefs[i]!)),
    );

    // Not frozen at cart creation — see CartView.pricesIncludeTax's doc comment.
    const websiteTaxConfig = await this.websiteTaxConfig.byId(cart.websiteId);
    const pricesIncludeTax = websiteTaxConfig?.pricesIncludeTax ?? false;

    const priced = lines.map((l) => l.lineTotal).filter((v): v is string => v !== null);
    const subtotal =
      priced.length > 0 ? fromMinorUnits(addMinor(...priced.map(toMinorUnits))) : null;

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
          return pricesIncludeTax
            ? extractTaxExclusive(lineTotalMinor, taxClass.rateMinor).taxMinor
            : applyRate(lineTotalMinor, taxClass.rateMinor);
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
      discountLines.push({
        variantId: cart.lines[i]!.variantId,
        productId: variant.productId,
        subtotalMinor: toMinorUnits(lineTotal),
      });
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
        for (const d of evaluation.lineDiscounts)
          lineDiscountByVariant.set(d.variantId.toString(), d.discountAmountMinor);
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
        for (const d of evaluation.lineDiscounts)
          lineDiscountByVariant.set(d.variantId.toString(), d.discountAmountMinor);
      }
    }

    // Exclusive: tax isn't inside subtotal yet, so it's added on top, same as
    // grandTotal = subtotal + tax - discount at real checkout (minus shipping,
    // not yet known here). Inclusive: tax is already inside subtotal — adding
    // it again would double-count, so the formula is unchanged from before
    // this estimate existed.
    let estimatedTotal = subtotal;
    if (estimatedTotal !== null && discountTotal !== null) {
      estimatedTotal = fromMinorUnits(
        subtractMinor(toMinorUnits(estimatedTotal), toMinorUnits(discountTotal)),
      );
    }
    if (estimatedTotal !== null && !pricesIncludeTax && taxTotal !== null) {
      estimatedTotal = fromMinorUnits(
        addMinor(toMinorUnits(estimatedTotal), toMinorUnits(taxTotal)),
      );
    }

    const linesWithDiscount = lines.map((l, i) => {
      const amount = lineDiscountByVariant.get(cart.lines[i]!.variantId.toString());
      return { ...l, discountAmount: amount !== undefined ? fromMinorUnits(amount) : null };
    });

    const { tenders, amountDue, tenderError, walletUnavailableReason } = await this.resolveTenders(
      cart,
      estimatedTotal,
    );
    const customerGroup = cart.customerGroupId
      ? await this.customerGroups.byId(cart.customerGroupId)
      : null;

    return {
      publicId: cart.publicId,
      currency: cart.currency,
      status: cart.status,
      customerGroupName: customerGroup?.name ?? null,
      lines: linesWithDiscount,
      subtotal,
      couponCode,
      couponIsAutoApplied,
      discountTotal,
      couponError,
      estimatedTotal,
      pricesIncludeTax,
      taxTotal,
      tenders,
      amountDue,
      tenderError,
      walletUnavailableReason,
    };
  }

  /**
   * Live-computed, never persisted — same philosophy as the coupon discount
   * above. Gift card tenders drain first (in the order applied), then
   * wallet, capping each at what's still due — the exact resolution order
   * CompleteCheckout's real hold-placement loop uses, so a cart preview
   * shows the true amount each tender will actually cover. Any resolution
   * failure (a since-disabled gift card, a since-frozen wallet, a currency
   * mismatch) is caught into tenderError instead of thrown — a plain cart
   * read must never break because of it; checkout re-validates for real.
   */
  private async resolveTenders(
    cart: EnrichableCart,
    estimatedTotal: string | null,
  ): Promise<{
    tenders: CartTenderDto[];
    amountDue: string | null;
    tenderError: string | null;
    walletUnavailableReason: string | null;
  }> {
    // Read once — needed even when no WALLET tender is currently applied, so
    // the storefront can decide whether to offer the toggle at all (plan/17).
    const walletRules =
      (await this.walletSettings.byId(cart.websiteId)) ?? UNRESTRICTED_WALLET_SETTINGS;
    const walletUnavailableReason = computeWalletUnavailableReason(estimatedTotal, walletRules);

    if (cart.tenders.length === 0) {
      return { tenders: [], amountDue: estimatedTotal, tenderError: null, walletUnavailableReason };
    }
    if (estimatedTotal === null) {
      return { tenders: [], amountDue: null, tenderError: null, walletUnavailableReason };
    }

    // Same 3-way priority as CompleteCheckout's real resolution loop —
    // gift cards drain first, then wallet, then credit terms last.
    const TENDER_PRIORITY: Record<CartTenderView['tenderType'], number> = {
      GIFT_CARD: 0,
      WALLET: 1,
      CREDIT_TERMS: 2,
    };
    const sorted = [...cart.tenders].sort((a, b) => {
      if (a.tenderType !== b.tenderType)
        return TENDER_PRIORITY[a.tenderType] - TENDER_PRIORITY[b.tenderType];
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const tenders: CartTenderDto[] = [];
    let remainingMinor = toMinorUnits(estimatedTotal);
    let tenderError: string | null = null;

    for (const tender of sorted) {
      try {
        if (tender.tenderType === 'GIFT_CARD') {
          const giftCard = await this.giftCards.findById(tender.giftCardId!);
          if (!giftCard)
            throw new DomainError(
              'applied gift card no longer exists',
              'https://errors.ome/gift-card-not-found',
              404,
            );
          if (giftCard.status !== 'ACTIVE')
            throw new DomainError(
              'applied gift card is no longer active',
              'https://errors.ome/gift-card-not-active',
              409,
            );
          if (giftCard.currency !== cart.currency)
            throw new DomainError(
              'applied gift card currency no longer matches the cart',
              'https://errors.ome/currency-mismatch',
              409,
            );
          const availableMinor = subtractMinor(
            toMinorUnits(giftCard.balance),
            toMinorUnits(giftCard.heldBalance),
          );
          const appliedMinor = availableMinor < remainingMinor ? availableMinor : remainingMinor;
          const appliedAmount = appliedMinor > 0n ? fromMinorUnits(appliedMinor) : '0.0000';
          tenders.push({
            tenderType: 'GIFT_CARD',
            giftCardLast4: giftCard.codeLast4,
            giftCardPublicId: giftCard.publicId,
            appliedAmount,
          });
          remainingMinor = subtractMinor(remainingMinor, appliedMinor > 0n ? appliedMinor : 0n);
        } else if (tender.tenderType === 'WALLET') {
          if (!cart.customerId)
            throw new DomainError(
              'a wallet tender requires a signed-in customer',
              'https://errors.ome/wallet-requires-customer',
              409,
            );
          if (walletUnavailableReason)
            throw new DomainError(
              walletUnavailableReason,
              'https://errors.ome/wallet-not-available',
              409,
            );
          const wallet = await this.wallets.getOrCreateWallet(
            cart.customerId,
            cart.websiteId,
            cart.currency,
          );
          const snapshot = await this.wallets.findByPublicId(wallet.publicId);
          if (!snapshot)
            throw new DomainError(
              'wallet no longer exists',
              'https://errors.ome/wallet-not-found',
              404,
            );
          if (snapshot.status !== 'ACTIVE')
            throw new DomainError('wallet is frozen', 'https://errors.ome/wallet-frozen', 409);
          const availableMinor = subtractMinor(
            toMinorUnits(snapshot.balance),
            toMinorUnits(snapshot.heldBalance),
          );
          let appliedMinor = availableMinor < remainingMinor ? availableMinor : remainingMinor;
          const capMinor = walletCapMinor(toMinorUnits(estimatedTotal), walletRules);
          if (capMinor < appliedMinor) appliedMinor = capMinor;
          const appliedAmount = appliedMinor > 0n ? fromMinorUnits(appliedMinor) : '0.0000';
          tenders.push({
            tenderType: 'WALLET',
            giftCardLast4: null,
            giftCardPublicId: null,
            appliedAmount,
          });
          remainingMinor = subtractMinor(remainingMinor, appliedMinor > 0n ? appliedMinor : 0n);
        } else {
          if (!cart.customerId)
            throw new DomainError(
              'a credit-terms tender requires a signed-in customer',
              'https://errors.ome/credit-terms-requires-customer',
              409,
            );
          const membership = await this.companyMemberships.findActiveByCustomerId(cart.customerId);
          if (!membership?.creditAccountId) {
            throw new DomainError(
              'this customer has no B2B credit account',
              'https://errors.ome/credit-account-not-found',
              409,
            );
          }
          const account = await this.companyCredit.findById(membership.creditAccountId);
          if (!account)
            throw new DomainError(
              'B2B credit account no longer exists',
              'https://errors.ome/credit-account-not-found',
              404,
            );
          if (account.status !== 'ACTIVE')
            throw new DomainError(
              'B2B credit account is frozen',
              'https://errors.ome/credit-account-frozen',
              409,
            );
          if (account.currency !== cart.currency)
            throw new DomainError(
              'credit account currency no longer matches the cart',
              'https://errors.ome/currency-mismatch',
              409,
            );
          const availableMinor = subtractMinor(
            toMinorUnits(account.creditLimit),
            toMinorUnits(account.outstanding),
          );
          const appliedMinor = availableMinor < remainingMinor ? availableMinor : remainingMinor;
          const appliedAmount = appliedMinor > 0n ? fromMinorUnits(appliedMinor) : '0.0000';
          tenders.push({
            tenderType: 'CREDIT_TERMS',
            giftCardLast4: null,
            giftCardPublicId: null,
            appliedAmount,
          });
          remainingMinor = subtractMinor(remainingMinor, appliedMinor > 0n ? appliedMinor : 0n);
        }
      } catch (err) {
        // Same soft-fail-on-read shape as couponError — surface it, but keep
        // showing every OTHER tender's real contribution rather than
        // aborting the whole preview over one bad tender.
        tenderError =
          err instanceof DomainError
            ? err.message
            : 'one of the applied tenders is no longer valid';
        tenders.push({
          tenderType: tender.tenderType,
          giftCardLast4: null,
          giftCardPublicId: null,
          appliedAmount: '0.0000',
        });
      }
    }

    return {
      tenders,
      amountDue: fromMinorUnits(remainingMinor),
      tenderError,
      walletUnavailableReason,
    };
  }

  private async enrichLine(
    line: CartLineView,
    cart: EnrichableCart,
    variant: VariantRef,
  ): Promise<CartLineDto> {
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
    const lineTotal =
      price !== null ? fromMinorUnits(multiplyByQty(toMinorUnits(price), line.qty)) : null;
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

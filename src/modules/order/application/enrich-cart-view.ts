import type { VariantLookup, CartProductMediaLookup, CartLineView } from '../domain/repositories.js';
import type { MediaUrlResolver } from '../domain/ports.js';
import type { PriceResolver } from '../../pricing/domain/repositories.js';
import { addMinor, multiplyByQty, toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';
import type { CartLineDto, CartView } from './dto.js';

interface EnrichableCart {
  publicId: string;
  currency: string;
  websiteId: bigint;
  customerGroupId: bigint | null;
  status: string;
  lines: CartLineView[];
}

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
  ) {}

  async execute(cart: EnrichableCart): Promise<CartView> {
    const lines: CartLineDto[] = await Promise.all(
      cart.lines.map((line) => this.enrichLine(line, cart)),
    );

    const priced = lines.map((l) => l.lineTotal).filter((v): v is string => v !== null);
    const subtotal = priced.length > 0 ? fromMinorUnits(addMinor(...priced.map(toMinorUnits))) : null;

    return { publicId: cart.publicId, currency: cart.currency, status: cart.status, lines, subtotal };
  }

  private async enrichLine(line: CartLineView, cart: EnrichableCart): Promise<CartLineDto> {
    const variant = await this.variants.byId(line.variantId);
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
    };
  }
}

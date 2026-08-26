import type { CouponRepository, ProductLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { OfferView } from './dto.js';

/** Backs the storefront PDP's "Offers" section — real, currently-
 *  applicable coupons only (see CouponRepository.listApplicableForProduct's
 *  own doc comment for the matching logic reused from cart evaluation).
 *  Never fabricates a bank/card-style offer — this system has no such
 *  concept (see this feature's own plan). */
export class ListApplicableOffers {
  constructor(
    private readonly coupons: CouponRepository,
    private readonly products: ProductLookup,
  ) {}

  async execute(productPublicId: string): Promise<OfferView[]> {
    const product = await this.products.byPublicId(productPublicId);
    if (!product) throw new NotFoundError('product', productPublicId);

    const rows = await this.coupons.listApplicableForProduct(product.id, new Date());
    return rows.map((c) => ({
      code: c.isAutoApply ? null : c.code,
      description: c.description,
      discountType: c.discountType,
      value: c.value,
      currency: c.currency,
      minSubtotal: c.minSubtotal,
      isAutoApply: c.isAutoApply,
    }));
  }
}

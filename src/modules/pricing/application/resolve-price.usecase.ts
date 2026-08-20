import type {
  PriceResolver,
  VariantLookup,
  CustomerGroupRepository,
  WebsiteLookup,
} from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { ResolvePriceQuery, ResolvedPriceView } from './dto.js';

export class ResolvePrice {
  constructor(
    private readonly resolver: PriceResolver,
    private readonly variants: VariantLookup,
    private readonly customerGroups: CustomerGroupRepository,
    private readonly websites: WebsiteLookup,
  ) {}

  async execute(query: ResolvePriceQuery): Promise<ResolvedPriceView> {
    const variant = await this.variants.byPublicId(query.variantPublicId);
    if (!variant) throw new NotFoundError('ProductVariant', query.variantPublicId);

    let customerGroupId: bigint | null = null;
    if (query.customerGroupCode) {
      const group = await this.customerGroups.findByCode(query.customerGroupCode);
      if (!group) throw new NotFoundError('CustomerGroup', query.customerGroupCode);
      customerGroupId = group.id;
    }

    let websiteId: bigint | null = null;
    if (query.websiteCode) {
      const website = await this.websites.byCode(query.websiteCode);
      if (!website) throw new NotFoundError('Website', query.websiteCode);
      websiteId = website.id;
    }

    const resolved = await this.resolver.resolve({
      variantId: variant.id,
      qty: query.qty,
      currency: query.currency,
      customerGroupId,
      websiteId,
      asOf: new Date(),
    });
    if (!resolved) {
      throw new NotFoundError('Price', `no price configured for variant ${query.variantPublicId}`);
    }
    return {
      price: resolved.price,
      priceListCode: resolved.priceListCode,
      source: resolved.source,
      mrp: resolved.mrp,
    };
  }
}

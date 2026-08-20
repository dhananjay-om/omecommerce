import type { PriceListRepository, VariantLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { VariantPriceView } from './dto.js';

/** Every price list's price for one variant — powers the "Pricing & Inventory" section on the admin product edit page. */
export class ListVariantPrices {
  constructor(
    private readonly priceLists: PriceListRepository,
    private readonly variants: VariantLookup,
  ) {}

  async execute(variantPublicId: string): Promise<VariantPriceView[]> {
    const variant = await this.variants.byPublicId(variantPublicId);
    if (!variant) throw new NotFoundError('ProductVariant', variantPublicId);
    return this.priceLists.listPricesForVariant(variant.id);
  }
}

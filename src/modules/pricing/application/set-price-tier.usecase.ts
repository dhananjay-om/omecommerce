import type { PriceListRepository, VariantLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { SetPriceTierCommand } from './dto.js';

export class SetPriceTier {
  constructor(
    private readonly priceLists: PriceListRepository,
    private readonly variants: VariantLookup,
  ) {}

  async execute(cmd: SetPriceTierCommand): Promise<void> {
    const priceList = await this.priceLists.findByCode(cmd.priceListCode);
    if (!priceList) throw new NotFoundError('PriceList', cmd.priceListCode);

    const variant = await this.variants.byPublicId(cmd.variantPublicId);
    if (!variant) throw new NotFoundError('ProductVariant', cmd.variantPublicId);

    await this.priceLists.setPriceTier(priceList.id, variant.id, cmd.minQty, cmd.price);
  }
}

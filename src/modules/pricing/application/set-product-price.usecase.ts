import type { PriceListRepository, VariantLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { SetProductPriceCommand } from './dto.js';

export class SetProductPrice {
  constructor(
    private readonly priceLists: PriceListRepository,
    private readonly variants: VariantLookup,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: SetProductPriceCommand): Promise<void> {
    const priceList = await this.priceLists.findByCode(cmd.priceListCode);
    if (!priceList) throw new NotFoundError('PriceList', cmd.priceListCode);

    const variant = await this.variants.byPublicId(cmd.variantPublicId);
    if (!variant) throw new NotFoundError('ProductVariant', cmd.variantPublicId);

    await this.priceLists.setProductPrice(priceList.id, variant.id, cmd.price, cmd.mrp ?? null);

    await this.outbox.write({
      aggregateType: 'ProductVariant',
      aggregateId: cmd.variantPublicId,
      eventType: 'ProductPriceChanged',
      payload: { priceListCode: cmd.priceListCode, price: cmd.price, mrp: cmd.mrp ?? null },
    });
  }
}

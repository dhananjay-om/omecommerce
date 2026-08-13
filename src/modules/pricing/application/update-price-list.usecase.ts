import type { PriceListRepository, CurrencyLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { UpdatePriceListCommand, PriceListView } from './dto.js';

export class UpdatePriceList {
  constructor(
    private readonly priceLists: PriceListRepository,
    private readonly currencies: CurrencyLookup,
  ) {}

  async execute(cmd: UpdatePriceListCommand): Promise<PriceListView> {
    const priceList = await this.priceLists.findByCode(cmd.code);
    if (!priceList) throw new NotFoundError('price list', cmd.code);

    if (cmd.currency && !(await this.currencies.byCode(cmd.currency))) {
      throw new NotFoundError('Currency', cmd.currency);
    }

    const pl = await this.priceLists.update(priceList.id, {
      name: cmd.name,
      currency: cmd.currency,
      type: cmd.type,
      priority: cmd.priority,
      isActive: cmd.isActive,
    });
    return {
      publicId: pl.publicId,
      code: pl.code,
      name: pl.name,
      currency: pl.currency,
      type: pl.type,
      priority: pl.priority,
      isActive: pl.isActive,
    };
  }
}

import type { PriceListRepository } from '../domain/repositories.js';
import type { PriceListView } from './dto.js';

export class ListPriceLists {
  constructor(private readonly priceLists: PriceListRepository) {}

  async execute(): Promise<PriceListView[]> {
    const rows = await this.priceLists.list();
    return rows.map((pl) => ({
      publicId: pl.publicId,
      code: pl.code,
      name: pl.name,
      currency: pl.currency,
      type: pl.type,
      priority: pl.priority,
      isActive: pl.isActive,
    }));
  }
}

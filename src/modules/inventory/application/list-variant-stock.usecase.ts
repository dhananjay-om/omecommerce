import type { VariantLookup, StockLedger } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { VariantStockItemView } from './dto.js';

/** Every active warehouse's stock snapshot for one variant — powers the "Pricing & Inventory" section on the admin product edit page. */
export class ListVariantStock {
  constructor(
    private readonly variants: VariantLookup,
    private readonly ledger: StockLedger,
  ) {}

  async execute(variantPublicId: string): Promise<VariantStockItemView[]> {
    const variant = await this.variants.byPublicId(variantPublicId);
    if (!variant) throw new NotFoundError('ProductVariant', variantPublicId);
    return this.ledger.listByVariant(variant.id);
  }
}

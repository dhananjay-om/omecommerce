import type { PriceListRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/**
 * Soft-delete: sets deletedAt + isActive=false. Unlike warehouse deletion, this is never
 * guarded/blocked — PriceResolver already filters is_active/deleted_at (plan/01 §7), so a
 * price list currently in use simply stops being considered, exactly like deactivating it.
 * Its ProductPrice/PriceTier rows are kept, not cascaded, so re-creating the same code (or a
 * future "restore" action) would find the same prices still there.
 */
export class DeletePriceList {
  constructor(private readonly priceLists: PriceListRepository) {}

  async execute(code: string): Promise<void> {
    const priceList = await this.priceLists.findByCode(code);
    if (!priceList) throw new NotFoundError('price list', code);
    await this.priceLists.softDelete(priceList.id);
  }
}

import type { WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';

/**
 * Soft-delete, guarded: rejects a warehouse that still has non-zero on-hand or reserved
 * stock anywhere, so a warehouse's physical inventory can't silently disappear from view.
 * Transfer/zero out its stock first, then delete. See WarehouseRepository.softDelete for
 * why this can never be a hard row delete.
 */
export class DeleteWarehouse {
  constructor(
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
  ) {}

  async execute(code: string): Promise<void> {
    const warehouse = await this.warehouses.findByCode(code);
    if (!warehouse) throw new NotFoundError('warehouse', code);

    if (await this.ledger.hasStock(warehouse.id)) {
      throw new ConflictError('cannot delete a warehouse that still has stock — adjust its stock to zero first');
    }
    await this.warehouses.softDelete(warehouse.id);
  }
}

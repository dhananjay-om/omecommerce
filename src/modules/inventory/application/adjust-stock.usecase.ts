import type { VariantLookup, WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { resolveStockItemId } from './resolve-stock-item.js';
import type { AdjustStockCommand, StockView } from './dto.js';

export class AdjustStock {
  constructor(
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
  ) {}

  async execute(cmd: AdjustStockCommand): Promise<StockView> {
    const stockItemId = await resolveStockItemId(
      this.variants,
      this.warehouses,
      this.ledger,
      cmd.variantPublicId,
      cmd.warehouseCode,
    );
    const snapshot = await this.ledger.adjust(stockItemId, cmd.delta, cmd.reason, { note: cmd.note });
    return snapshot;
  }
}

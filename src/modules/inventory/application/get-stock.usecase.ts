import type { VariantLookup, WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { resolveStockItemId } from './resolve-stock-item.js';
import type { GetStockQuery, StockView } from './dto.js';

export class GetStock {
  constructor(
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
  ) {}

  async execute(query: GetStockQuery): Promise<StockView> {
    const stockItemId = await resolveStockItemId(
      this.variants,
      this.warehouses,
      this.ledger,
      query.variantPublicId,
      query.warehouseCode,
    );
    const snapshot = await this.ledger.getStock(stockItemId);
    return snapshot ?? { onHand: 0, reserved: 0, available: 0 };
  }
}

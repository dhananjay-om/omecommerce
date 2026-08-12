import type { WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { WarehouseStockItemView } from './dto.js';

export class ListWarehouseStock {
  constructor(
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
  ) {}

  async execute(warehouseCode: string): Promise<WarehouseStockItemView[]> {
    const warehouse = await this.warehouses.findByCode(warehouseCode);
    if (!warehouse) {
      throw new NotFoundError('Warehouse', warehouseCode);
    }
    return this.ledger.listByWarehouse(warehouse.id);
  }
}

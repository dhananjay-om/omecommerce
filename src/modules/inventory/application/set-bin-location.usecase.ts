import type { VariantLookup, WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { SetBinLocationCommand } from './dto.js';

/** Pick & Pack (Fulfillment feature area) — records where a variant's
 *  stock physically sits at one warehouse. Same "resolve by sku +
 *  warehouseCode, upsert via the ledger" shape as SetStockQuantity;
 *  `binLocation: null` clears a previously-set location rather than
 *  requiring a separate "clear" command. */
export class SetBinLocation {
  constructor(
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
  ) {}

  async execute(cmd: SetBinLocationCommand): Promise<void> {
    const variant = await this.variants.bySku(cmd.sku);
    if (!variant) throw new NotFoundError('ProductVariant', cmd.sku);

    const warehouse = await this.warehouses.findByCode(cmd.warehouseCode);
    if (!warehouse) throw new NotFoundError('Warehouse', cmd.warehouseCode);

    await this.ledger.setBinLocation(variant.id, warehouse.id, cmd.binLocation);
  }
}

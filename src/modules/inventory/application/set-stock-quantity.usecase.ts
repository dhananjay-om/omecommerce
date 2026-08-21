import type { VariantLookup, WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { SetStockQuantityCommand, StockView } from './dto.js';

/**
 * Sets one variant's on-hand quantity at one warehouse to an absolute value
 * — the CSV/bulk-import shape ("this SKU now has 42 units"), unlike
 * AdjustStock's delta ("add/remove N units"). There's no separate "set
 * absolute" primitive on StockLedger itself: this reads the current
 * snapshot and computes the equivalent delta, then goes through the exact
 * same guarded adjust() every other stock mutation uses — same audit trail
 * (a StockMovement row), same negative-on-hand guard, no second code path
 * to keep correct. The read-then-write isn't perfectly race-safe against a
 * concurrent adjustment to the SAME stock item (a narrow TOCTOU window),
 * but this is an admin bulk operation, not a checkout path — the same
 * precision level the existing single-item "Adjust Stock" dialog already
 * has (it doesn't re-read either), and adjust()'s own guarded UPDATE still
 * prevents the one outcome that actually matters: on-hand going negative.
 */
export class SetStockQuantity {
  constructor(
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
  ) {}

  async execute(cmd: SetStockQuantityCommand): Promise<StockView> {
    const variant = await this.variants.bySku(cmd.sku);
    if (!variant) throw new NotFoundError('ProductVariant', cmd.sku);

    const warehouse = await this.warehouses.findByCode(cmd.warehouseCode);
    if (!warehouse) throw new NotFoundError('Warehouse', cmd.warehouseCode);

    const item = await this.ledger.getOrCreateStockItem(variant.id, warehouse.id);
    const current = await this.ledger.getStock(item.id);
    const currentOnHand = current?.onHand ?? 0;
    const delta = cmd.quantity - currentOnHand;

    // Already at the target — adjust() would reject a zero delta as a
    // pointless movement row; nothing to do, just report the unchanged state.
    if (delta === 0) {
      return current ?? { onHand: 0, reserved: 0, available: 0 };
    }

    return this.ledger.adjust(item.id, delta, 'CORRECTION', { note: cmd.note });
  }
}

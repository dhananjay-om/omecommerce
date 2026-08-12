import type { VariantLookup, WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/** Shared helper: variant publicId + warehouse code -> internal stock_item id. */
export async function resolveStockItemId(
  variants: VariantLookup,
  warehouses: WarehouseRepository,
  ledger: StockLedger,
  variantPublicId: string,
  warehouseCode: string,
): Promise<bigint> {
  const variant = await variants.byPublicId(variantPublicId);
  if (!variant) throw new NotFoundError('ProductVariant', variantPublicId);

  const warehouse = await warehouses.findByCode(warehouseCode);
  if (!warehouse) throw new NotFoundError('Warehouse', warehouseCode);

  const item = await ledger.getOrCreateStockItem(variant.id, warehouse.id);
  return item.id;
}

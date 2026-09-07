import type { OrderRepository, WarehouseResolver } from '../domain/repositories.js';
import type { StockLedger } from '../../inventory/domain/repositories.js';
import type { ListPickListQuery, PickListDto } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Pick & Pack — the one genuinely new domain in this feature area (see
 *  the Fulfillment plan's own doc comment: no pick-list/bin-location
 *  concept existed anywhere before this). Every paid, not-yet-fully-
 *  fulfilled order, oldest first (FIFO — the real warehouse priority),
 *  each annotated with its real bin location per line where one's been
 *  set (StockLedger.setBinLocation) — a line with none just shows
 *  "Unassigned" rather than a fabricated location. The full `lines`
 *  array is carried through unfiltered so the existing FulfillDialog can
 *  be reused as-is for the actual pack/ship step — no second fulfillment
 *  write path. */
export class ListPickList {
  constructor(
    private readonly orders: OrderRepository,
    private readonly warehouses: WarehouseResolver,
    private readonly ledger: StockLedger,
  ) {}

  async execute(query: ListPickListQuery): Promise<PickListDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.orders.listPickableOrders({ page, pageSize });

    // Resolve each distinct store's warehouse once, not once per order —
    // most pick-list pages are all one store, and even a mixed one only
    // has a handful of distinct stores on a page.
    const warehouseByStoreId = new Map<string, { id: bigint; code: string } | null>();
    for (const order of result.orders) {
      const key = order.storeId.toString();
      if (!warehouseByStoreId.has(key)) {
        warehouseByStoreId.set(key, await this.warehouses.resolveForStore(order.storeId));
      }
    }

    const pairs: Array<{ variantId: bigint; warehouseId: bigint }> = [];
    for (const order of result.orders) {
      const warehouse = warehouseByStoreId.get(order.storeId.toString());
      if (!warehouse) continue;
      for (const line of order.lines) {
        if (line.qty - line.fulfilledQty > 0) pairs.push({ variantId: line.variantId, warehouseId: warehouse.id });
      }
    }
    const binLocations = await this.ledger.getBinLocations(pairs);

    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      orders: result.orders
        .map((order) => {
          const warehouse = warehouseByStoreId.get(order.storeId.toString());
          // No warehouse resolvable for this order's store at all (a
          // real setup gap, e.g. a store with no warehouse mapped and no
          // active warehouse anywhere) — omit rather than show a pick
          // ticket that can't actually be fulfilled from anywhere.
          if (!warehouse) return null;
          const pickLines = order.lines
            .filter((l) => l.qty - l.fulfilledQty > 0)
            .map((l) => ({
              sku: l.sku,
              name: l.name,
              qtyNeeded: l.qty - l.fulfilledQty,
              binLocation: binLocations.get(`${l.variantId}:${warehouse.id}`) ?? null,
            }));
          return {
            orderPublicId: order.publicId,
            orderNumber: order.orderNumber,
            email: order.email,
            createdAt: order.createdAt.toISOString(),
            warehouseCode: warehouse.code,
            lines: order.lines.map((l) => ({
              sku: l.sku,
              name: l.name,
              qty: l.qty,
              unitPrice: l.unitPrice,
              mrp: l.mrp,
              taxAmount: l.taxAmount,
              discountAmount: l.discountAmount,
              rowTotal: l.rowTotal,
              taxClassCode: l.taxClassCode,
              hsnCode: l.hsnCode,
              fulfilledQty: l.fulfilledQty,
              refundedQty: l.refundedQty,
            })),
            pickLines,
          };
        })
        .filter((o): o is NonNullable<typeof o> => o !== null),
    };
  }
}

import type { VariantLookup, WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { resolveStockItemId } from './resolve-stock-item.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { AdjustStockCommand, StockView } from './dto.js';

export class AdjustStock {
  constructor(
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
    private readonly outbox: OutboxWriter,
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

    // Inventory's first outbox event — same immediate-follow-up-write trade-off
    // documented in Catalog's CreateProduct (not part of ledger.adjust()'s own
    // transaction).
    await this.outbox.write({
      aggregateType: 'StockItem',
      aggregateId: cmd.variantPublicId,
      eventType: 'StockChanged',
      payload: { warehouseCode: cmd.warehouseCode, delta: cmd.delta, reason: cmd.reason, onHand: snapshot.onHand },
    });
    return snapshot;
  }
}

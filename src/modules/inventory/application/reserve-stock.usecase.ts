import type { VariantLookup, WarehouseRepository, StockLedger } from '../domain/repositories.js';
import { resolveStockItemId } from './resolve-stock-item.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { ReserveStockCommand, ReservationView } from './dto.js';

export class ReserveStock {
  constructor(
    private readonly variants: VariantLookup,
    private readonly warehouses: WarehouseRepository,
    private readonly ledger: StockLedger,
  ) {}

  async execute(cmd: ReserveStockCommand): Promise<ReservationView> {
    if (!/^\d+$/.test(cmd.refId)) {
      throw new ValidationError('invalid refId', [{ path: 'refId', message: 'expected numeric id' }]);
    }
    const stockItemId = await resolveStockItemId(
      this.variants,
      this.warehouses,
      this.ledger,
      cmd.variantPublicId,
      cmd.warehouseCode,
    );
    const reservation = await this.ledger.reserve(
      stockItemId,
      cmd.qty,
      cmd.refType,
      BigInt(cmd.refId),
      cmd.ttlSeconds,
    );
    return {
      reservationId: reservation.publicId,
      expiresAt: reservation.expiresAt ? reservation.expiresAt.toISOString() : null,
    };
  }
}

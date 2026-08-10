import type { ReservationRefType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  StockLedger,
  StockSnapshot,
  ReservationHandle,
  ReservationInfo,
  WarehouseStockRow,
  VariantStockRow,
} from '../domain/repositories.js';
import { InsufficientStockError, InvalidReservationStateError } from '../domain/errors.js';
import { computeExpiry } from '../domain/reservation.js';

interface StockItemRow {
  on_hand: number;
  reserved: number;
  available: number;
}

interface ReservationStockItemRow {
  stock_item_id: bigint;
  qty: number;
  ref_type: string;
  ref_id: bigint;
}

function toSnapshot(row: StockItemRow): StockSnapshot {
  return { onHand: row.on_hand, reserved: row.reserved, available: row.available };
}

/**
 * The stock ledger implementation (plan/07 §2). Every write is a guarded, atomic
 * UPDATE + an append-only stock_movement insert inside one transaction — never a
 * plain UPDATE stock_item followed by a separate check. This is what makes
 * reservations race-safe: two concurrent reserve() calls racing for the last unit
 * both run `WHERE (on_hand - reserved) >= qty`; only one can win, because Postgres
 * serializes concurrent UPDATEs to the same row.
 */
export class PrismaStockLedger implements StockLedger {
  constructor(private readonly db: Db) {}

  async getOrCreateStockItem(variantId: bigint, warehouseId: bigint): Promise<{ id: bigint }> {
    const item = await this.db.stockItem.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      update: {},
      create: { variantId, warehouseId },
    });
    return { id: item.id };
  }

  async adjust(
    stockItemId: bigint,
    delta: number,
    reason: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER' | 'CORRECTION',
    opts: { note?: string; actorId?: bigint } = {},
  ): Promise<StockSnapshot> {
    return this.db.$transaction(async (tx) => {
      // Guarded: the on_hand>=0 CHECK is defense-in-depth; this WHERE prevents the
      // statement from even attempting a value that would violate it, so we can
      // distinguish "insufficient stock" (0 rows) from other failures.
      const rows = await tx.$queryRaw<StockItemRow[]>`
        UPDATE stock_item
           SET on_hand = on_hand + ${delta}
         WHERE id = ${stockItemId} AND on_hand + ${delta} >= 0
         RETURNING on_hand, reserved, available`;
      if (rows.length === 0) {
        throw new InsufficientStockError(Math.abs(delta));
      }
      const snapshot = rows[0]!;
      await tx.$executeRaw`
        INSERT INTO stock_movement (stock_item_id, delta, reason, ref_type, ref_id, balance_after, note, actor_id)
        VALUES (${stockItemId}, ${delta}, ${reason}::"MovementReason", NULL, NULL, ${snapshot.on_hand}, ${opts.note ?? null}, ${opts.actorId ?? null})`;
      return toSnapshot(snapshot);
    });
  }

  async reserve(
    stockItemId: bigint,
    qty: number,
    refType: ReservationRefType,
    refId: bigint,
    ttlSeconds?: number,
  ): Promise<ReservationHandle> {
    const expiresAt = computeExpiry(new Date(), ttlSeconds);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
        UPDATE stock_item
           SET reserved = reserved + ${qty}
         WHERE id = ${stockItemId} AND (on_hand - reserved) >= ${qty}
         RETURNING id`;
      if (rows.length === 0) {
        throw new InsufficientStockError(qty);
      }
      const reservation = await tx.stockReservation.create({
        data: { stockItemId, qty, refType, refId, status: 'ACTIVE', expiresAt },
      });
      return { id: reservation.id, publicId: reservation.publicId, expiresAt: reservation.expiresAt };
    });
  }

  async commitReservation(reservationPublicId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const resRows = await tx.$queryRaw<ReservationStockItemRow[]>`
        UPDATE stock_reservation
           SET status = 'COMMITTED'
         WHERE public_id = ${reservationPublicId}::uuid AND status = 'ACTIVE'
         RETURNING stock_item_id, qty, ref_type::text AS ref_type, ref_id`;
      if (resRows.length === 0) {
        throw new InvalidReservationStateError(`reservation ${reservationPublicId} is not ACTIVE`);
      }
      const { stock_item_id, qty, ref_type, ref_id } = resRows[0]!;
      const itemRows = await tx.$queryRaw<StockItemRow[]>`
        UPDATE stock_item
           SET on_hand = on_hand - ${qty}, reserved = reserved - ${qty}
         WHERE id = ${stock_item_id}
         RETURNING on_hand, reserved, available`;
      const snapshot = itemRows[0]!;
      await tx.$executeRaw`
        INSERT INTO stock_movement (stock_item_id, delta, reason, ref_type, ref_id, balance_after)
        VALUES (${stock_item_id}, ${-qty}, 'SALE', ${ref_type.toLowerCase()}, ${ref_id}, ${snapshot.on_hand})`;
    });
  }

  async releaseReservation(reservationPublicId: string): Promise<void> {
    await this.releaseByStatus(reservationPublicId, 'RELEASED');
  }

  async releaseExpired(now: Date): Promise<number> {
    const expired = await this.db.stockReservation.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      select: { publicId: true },
    });
    let count = 0;
    for (const r of expired) {
      try {
        await this.releaseByStatus(r.publicId, 'EXPIRED');
        count++;
      } catch {
        // lost race with a concurrent commit/release — not an error for the sweep
      }
    }
    return count;
  }

  async findReservationByPublicId(publicId: string): Promise<ReservationInfo | null> {
    const row = await this.db.stockReservation.findFirst({ where: { publicId } });
    if (!row) return null;
    return {
      id: row.id,
      publicId: row.publicId,
      stockItemId: row.stockItemId,
      qty: row.qty,
      status: row.status,
      refType: row.refType,
      refId: row.refId,
      expiresAt: row.expiresAt,
    };
  }

  async getStock(stockItemId: bigint): Promise<StockSnapshot | null> {
    const rows = await this.db.$queryRaw<StockItemRow[]>`
      SELECT on_hand, reserved, available FROM stock_item WHERE id = ${stockItemId}`;
    return rows[0] ? toSnapshot(rows[0]) : null;
  }

  async listByWarehouse(warehouseId: bigint): Promise<WarehouseStockRow[]> {
    const rows = await this.db.$queryRaw<
      Array<{ variant_public_id: string; sku: string; on_hand: number; reserved: number; available: number }>
    >`
      SELECT v.public_id AS variant_public_id, v.sku, si.on_hand, si.reserved, si.available
        FROM stock_item si
        JOIN product_variant v ON v.id = si.variant_id
       WHERE si.warehouse_id = ${warehouseId}
       ORDER BY v.sku`;
    return rows.map((row) => ({
      variantPublicId: row.variant_public_id,
      sku: row.sku,
      onHand: row.on_hand,
      reserved: row.reserved,
      available: row.available,
    }));
  }

  async listByVariant(variantId: bigint): Promise<VariantStockRow[]> {
    // LEFT JOIN from warehouse (not stock_item) so a warehouse with no
    // stock_item row for this variant yet still shows up as a zeroed row —
    // "not stocked here" is a real, visible state, not an absent one.
    const rows = await this.db.$queryRaw<
      Array<{ warehouse_code: string; warehouse_name: string; on_hand: number; reserved: number; available: number }>
    >`
      SELECT w.code AS warehouse_code, w.name AS warehouse_name,
             COALESCE(si.on_hand, 0) AS on_hand, COALESCE(si.reserved, 0) AS reserved, COALESCE(si.available, 0) AS available
        FROM warehouse w
        LEFT JOIN stock_item si ON si.warehouse_id = w.id AND si.variant_id = ${variantId}
       WHERE w.deleted_at IS NULL AND w.is_active = true
       ORDER BY w.code`;
    return rows.map((row) => ({
      warehouseCode: row.warehouse_code,
      warehouseName: row.warehouse_name,
      onHand: row.on_hand,
      reserved: row.reserved,
      available: row.available,
    }));
  }

  async hasStock(warehouseId: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM stock_item
         WHERE warehouse_id = ${warehouseId} AND (on_hand <> 0 OR reserved <> 0)
      ) AS exists`;
    return rows[0]?.exists ?? false;
  }

  private async releaseByStatus(
    reservationPublicId: string,
    toStatus: 'RELEASED' | 'EXPIRED',
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const resRows = await tx.$queryRaw<ReservationStockItemRow[]>`
        UPDATE stock_reservation
           SET status = ${toStatus}::"ReservationStatus"
         WHERE public_id = ${reservationPublicId}::uuid AND status = 'ACTIVE'
         RETURNING stock_item_id, qty, ref_type::text AS ref_type, ref_id`;
      if (resRows.length === 0) {
        throw new InvalidReservationStateError(`reservation ${reservationPublicId} is not ACTIVE`);
      }
      const { stock_item_id, qty, ref_type, ref_id } = resRows[0]!;
      await tx.$executeRaw`
        UPDATE stock_item SET reserved = reserved - ${qty} WHERE id = ${stock_item_id} AND reserved >= ${qty}`;
      await tx.$executeRaw`
        INSERT INTO stock_movement (stock_item_id, delta, reason, ref_type, ref_id, balance_after)
        SELECT id, 0, 'RESERVATION_RELEASE', ${ref_type.toLowerCase()}, ${ref_id}, on_hand FROM stock_item WHERE id = ${stock_item_id}`;
    });
  }
}

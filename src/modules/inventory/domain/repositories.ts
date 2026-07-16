import type { WarehouseType, ReservationRefType } from '@prisma/client';

export interface WarehouseInfo {
  id: bigint;
  publicId: string;
  code: string;
  name: string;
  type: WarehouseType;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  type?: WarehouseType;
  priority?: number;
}

/** Persistence port for warehouses. */
export interface WarehouseRepository {
  create(input: CreateWarehouseInput): Promise<WarehouseInfo>;
  findByCode(code: string): Promise<WarehouseInfo | null>;
  list(): Promise<WarehouseInfo[]>;
}

/** Resolves a catalog variant's publicId to its internal id (read-only cross-module lookup). */
export interface VariantLookup {
  byPublicId(publicId: string): Promise<{ id: bigint; sku: string } | null>;
}

export interface StockSnapshot {
  onHand: number;
  reserved: number;
  available: number;
}

export interface WarehouseStockRow extends StockSnapshot {
  variantPublicId: string;
  sku: string;
}

export interface ReservationHandle {
  id: bigint;
  publicId: string;
  expiresAt: Date | null;
}

export interface ReservationInfo extends ReservationHandle {
  stockItemId: bigint;
  qty: number;
  status: string;
  refType: ReservationRefType;
  refId: bigint;
}

/**
 * The stock ledger (plan/07 §2). Every mutation is a guarded UPDATE + an append-only
 * stock_movement row, executed atomically. Current on_hand/reserved are projections;
 * nothing outside this port writes to stock_item directly.
 */
export interface StockLedger {
  getOrCreateStockItem(variantId: bigint, warehouseId: bigint): Promise<{ id: bigint }>;

  /** Admin adjustment (purchase/return/correction/etc). Throws if on_hand would go negative. */
  adjust(
    stockItemId: bigint,
    delta: number,
    reason: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER' | 'CORRECTION',
    opts?: { note?: string; actorId?: bigint },
  ): Promise<StockSnapshot>;

  /** Race-safe: throws InsufficientStockError if (on_hand - reserved) < qty. */
  reserve(
    stockItemId: bigint,
    qty: number,
    refType: ReservationRefType,
    refId: bigint,
    ttlSeconds?: number,
  ): Promise<ReservationHandle>;

  /** ACTIVE -> COMMITTED: writes a SALE movement (on_hand -= qty, reserved -= qty). */
  commitReservation(reservationPublicId: string): Promise<void>;

  /** ACTIVE -> RELEASED: reserved -= qty only (on_hand unchanged). */
  releaseReservation(reservationPublicId: string): Promise<void>;

  /** Sweeps ACTIVE reservations past expiresAt to EXPIRED. Returns count released. */
  releaseExpired(now: Date): Promise<number>;

  findReservationByPublicId(publicId: string): Promise<ReservationInfo | null>;

  getStock(stockItemId: bigint): Promise<StockSnapshot | null>;

  /** All stock rows for a warehouse (admin browse), joined with the variant's sku/publicId. */
  listByWarehouse(warehouseId: bigint): Promise<WarehouseStockRow[]>;
}

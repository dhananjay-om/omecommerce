import type { WarehouseType, ReservationRefType } from '@prisma/client';

export interface WarehouseInfo {
  id: bigint;
  publicId: string;
  code: string;
  name: string;
  type: WarehouseType;
  priority: number;
  isActive: boolean;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  type?: WarehouseType;
  priority?: number;
}

export interface UpdateWarehouseInput {
  name?: string;
  type?: WarehouseType;
  priority?: number;
  isActive?: boolean;
}

/** Persistence port for warehouses. */
export interface WarehouseRepository {
  create(input: CreateWarehouseInput): Promise<WarehouseInfo>;
  findByCode(code: string): Promise<WarehouseInfo | null>;
  list(): Promise<WarehouseInfo[]>;
  update(id: bigint, input: UpdateWarehouseInput): Promise<WarehouseInfo>;
  /** Soft-delete only — every FK from stock_item/store_warehouse into warehouse is ON DELETE RESTRICT
   *  by design (the stock ledger is append-only), so a hard delete would fail once a warehouse has
   *  any history. This sets deletedAt (and isActive=false), which list()/listByVariant() already filter on. */
  softDelete(id: bigint): Promise<void>;
}

/** Resolves a catalog variant's publicId to its internal id (read-only cross-module lookup). */
export interface VariantLookup {
  byPublicId(publicId: string): Promise<{ id: bigint; sku: string } | null>;
  /** Bulk stock import's real key — an admin's CSV addresses rows by SKU, never a publicId. */
  bySku(sku: string): Promise<{ id: bigint; publicId: string; sku: string } | null>;
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

export interface VariantStockRow extends StockSnapshot {
  warehouseCode: string;
  warehouseName: string;
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
  /** Every active warehouse's stock snapshot for one variant (product-edit page) — includes warehouses with no stock_item row yet as a zeroed row, so "no stock anywhere" is still visible per-warehouse rather than an empty list. */
  listByVariant(variantId: bigint): Promise<VariantStockRow[]>;
  /** True if the warehouse has any non-zero on-hand or reserved stock anywhere — guards warehouse deletion. */
  hasStock(warehouseId: bigint): Promise<boolean>;
}

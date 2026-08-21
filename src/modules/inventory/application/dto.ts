import type { WarehouseType, MovementReason, ReservationRefType } from '@prisma/client';

export interface CreateWarehouseCommand {
  code: string;
  name: string;
  type?: WarehouseType;
  priority?: number;
}

export interface UpdateWarehouseCommand {
  code: string;
  name?: string;
  type?: WarehouseType;
  priority?: number;
  isActive?: boolean;
}

export interface WarehouseView {
  publicId: string;
  code: string;
  name: string;
  type: WarehouseType;
  priority: number;
  isActive: boolean;
}

export interface AdjustStockCommand {
  variantPublicId: string;
  warehouseCode: string;
  delta: number;
  reason: Extract<MovementReason, 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER' | 'CORRECTION'>;
  note?: string;
}

export interface StockView {
  onHand: number;
  reserved: number;
  available: number;
}

export interface ReserveStockCommand {
  variantPublicId: string;
  warehouseCode: string;
  qty: number;
  refType: ReservationRefType;
  refId: string;
  ttlSeconds?: number;
}

export interface ReservationView {
  reservationId: string;
  expiresAt: string | null;
}

export interface GetStockQuery {
  variantPublicId: string;
  warehouseCode: string;
}

export interface WarehouseStockItemView {
  variantPublicId: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface VariantStockItemView {
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
}

/** Bulk stock import (Magento-style "update qty by SKU" CSV) — set/execute
 *  ONE row's on-hand quantity to an absolute value, not a delta. Reused by
 *  both a possible future single-row admin action and the bulk-import
 *  worker (which calls this once per CSV row). */
export interface SetStockQuantityCommand {
  sku: string;
  warehouseCode: string;
  /** The new on-hand total, not a change amount. */
  quantity: number;
  note?: string;
}

export interface BulkStockRow {
  sku: string;
  quantity: number;
}

export interface BulkStockRowError {
  row: number;
  sku: string;
  message: string;
}

export interface BulkStockResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: BulkStockRowError[];
}

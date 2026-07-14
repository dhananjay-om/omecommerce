import type { WarehouseType, MovementReason, ReservationRefType } from '@prisma/client';

export interface CreateWarehouseCommand {
  code: string;
  name: string;
  type?: WarehouseType;
  priority?: number;
}

export interface WarehouseView {
  publicId: string;
  code: string;
  name: string;
  type: WarehouseType;
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

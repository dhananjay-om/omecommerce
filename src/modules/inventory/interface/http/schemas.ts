import { z } from 'zod';
import { WarehouseType, ReservationRefType } from '@prisma/client';

export const createWarehouseSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  type: z.nativeEnum(WarehouseType).optional(),
  priority: z.number().int().optional(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  type: z.nativeEnum(WarehouseType).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const ADJUST_REASONS = ['PURCHASE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'CORRECTION'] as const;

export const setBinLocationSchema = z.object({
  sku: z.string().min(1),
  warehouseCode: z.string().min(1),
  // A blank string means "clear it" — normalized to a real `null` at the
  // route call site (not here — z.preprocess's output type doesn't infer
  // cleanly through this project's `parse<T>()` helper), genuinely
  // different from the "blank means leave unchanged" contract this
  // session's other optional-string fields use (a token field, say).
  binLocation: z.string().trim().max(128),
});

export const adjustStockSchema = z.object({
  variantId: z.string().uuid(),
  warehouseCode: z.string().min(1),
  delta: z.number().int().refine((n) => n !== 0, 'delta must not be zero'),
  reason: z.enum(ADJUST_REASONS),
  note: z.string().max(1024).optional(),
});

export const getStockQuerySchema = z.object({
  variantId: z.string().uuid(),
  warehouseCode: z.string().min(1),
});

export const reserveStockSchema = z.object({
  variantId: z.string().uuid(),
  warehouseCode: z.string().min(1),
  qty: z.number().int().positive(),
  refType: z.nativeEnum(ReservationRefType),
  refId: z.string().regex(/^\d+$/, 'expected numeric id'),
  // Allows non-positive TTLs for tests to construct an already-expired reservation.
  ttlSeconds: z.number().int().max(86_400).optional(),
});

const bulkStockRowSchema = z.object({
  sku: z.string().min(1).max(128),
  // Absolute on-hand quantity, not a delta — zero is a valid target ("set to
  // out of stock"), negative is not.
  quantity: z.number().int().min(0),
});

// Same 10_000-row cap as bulkImportProductsSchema (catalog module) — matches
// the precedent, not an arbitrary new number.
export const bulkSetStockSchema = z.object({
  warehouseCode: z.string().min(1),
  rows: z.array(bulkStockRowSchema).min(1).max(10_000),
});

import { z } from 'zod';

const PINCODE_CODE = z.string().regex(/^\d{6}$/, 'expected a 6-digit pincode');

export const createPincodeSchema = z.object({
  code: PINCODE_CODE,
  city: z.string().min(1).max(128),
  state: z.string().min(1).max(128),
  estimatedDays: z.coerce.number().int().min(0).max(60),
  // Not `.default(true)` — that resolves to a Zod output/input split that
  // fights parse<T>()'s single-type-param signature; defaulted explicitly
  // in the use case instead (see CreatePincode/BulkUpsertPincodes).
  codAvailable: z.boolean().optional(),
});

export const updatePincodeSchema = z.object({
  city: z.string().min(1).max(128).optional(),
  state: z.string().min(1).max(128).optional(),
  estimatedDays: z.coerce.number().int().min(0).max(60).optional(),
  codAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const listPincodesQuerySchema = z.object({
  search: z.string().optional(),
  state: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

export const bulkUpsertPincodesSchema = z.object({
  rows: z.array(createPincodeSchema).min(1).max(5000),
});

export const pincodeCodeParamSchema = PINCODE_CODE;

import { z } from 'zod';
import { ProductType, ProductStatus, ProductVisibility, ScopeType } from '@prisma/client';

export const createProductSchema = z.object({
  type: z.nativeEnum(ProductType),
  sku: z.string().min(1).max(128),
  attributeSetId: z.string().regex(/^\d+$/, 'expected numeric id'),
  status: z.nativeEnum(ProductStatus).optional(),
  visibility: z.nativeEnum(ProductVisibility).optional(),
  nameDefault: z.string().max(512).nullish(),
});

export const assignAttributeValueSchema = z.object({
  attributeCode: z.string().min(1),
  scope: z.nativeEnum(ScopeType),
  websiteId: z.string().regex(/^\d+$/).nullish(),
  storeId: z.string().regex(/^\d+$/).nullish(),
  storeViewId: z.string().regex(/^\d+$/).nullish(),
  value: z.unknown(),
});

export const storeViewQuerySchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'storeViewId query param required'),
});

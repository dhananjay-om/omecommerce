import { z } from 'zod';
import { ProductType, ProductStatus, ProductVisibility, ScopeType, AttributeDataType, AttributeInputType } from '@prisma/client';

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

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  search: z.string().min(1).optional(),
});

export const createAttributeSetSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  isDefault: z.boolean().optional(),
});

export const createAttributeSetGroupSchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().optional(),
});

const attributeOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  swatch: z.string().nullish(),
  sortOrder: z.number().int().optional(),
});

export const createAttributeSchema = z.object({
  code: z.string().min(1).max(128),
  label: z.string().min(1).max(255),
  dataType: z.nativeEnum(AttributeDataType),
  inputType: z.nativeEnum(AttributeInputType),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isComparable: z.boolean().optional(),
  isSortable: z.boolean().optional(),
  isVisiblePdp: z.boolean().optional(),
  isVisiblePlp: z.boolean().optional(),
  usedInSearch: z.boolean().optional(),
  usedInLayeredNav: z.boolean().optional(),
  isVariantForming: z.boolean().optional(),
  options: z.array(attributeOptionSchema).optional(),
});

export const assignAttributeToGroupSchema = z.object({
  groupId: z.string().regex(/^\d+$/, 'expected numeric id'),
  attributeCode: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

const bulkImportRowSchema = z.object({
  sku: z.string().min(1).max(128),
  type: z.nativeEnum(ProductType),
  attributeSetId: z.string().regex(/^\d+$/, 'expected numeric id'),
  status: z.nativeEnum(ProductStatus).optional(),
  visibility: z.nativeEnum(ProductVisibility).optional(),
  nameDefault: z.string().max(512).nullish(),
  attributes: z.record(z.unknown()).optional(),
});

export const bulkImportProductsSchema = z.object({
  rows: z.array(bulkImportRowSchema).min(1).max(10_000),
});

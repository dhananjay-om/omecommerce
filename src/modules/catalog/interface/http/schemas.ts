import { z } from 'zod';
import {
  ProductType,
  ProductStatus,
  ProductVisibility,
  ScopeType,
  AttributeDataType,
  AttributeInputType,
  CategoryType,
  CategorySortMode,
  ProductMediaRole,
  VariantStatus,
} from '@prisma/client';

const decimalString = z.string().regex(/^\d+(\.\d{1,4})?$/, 'expected a decimal amount, e.g. "2.5"');

export const createProductSchema = z.object({
  type: z.nativeEnum(ProductType),
  sku: z.string().min(1).max(128),
  attributeSetId: z.string().regex(/^\d+$/, 'expected numeric id'),
  status: z.nativeEnum(ProductStatus).optional(),
  visibility: z.nativeEnum(ProductVisibility).optional(),
  nameDefault: z.string().max(512).nullish(),
  weight: decimalString.nullish(),
  taxClassId: z.string().regex(/^\d+$/, 'expected numeric id').nullish(),
  hsnCode: z.string().max(8).nullish(),
});

const variantAxisSchema = z.object({
  attributeCode: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1),
});

export const generateVariantsSchema = z.object({
  axes: z.array(variantAxisSchema).min(1),
});

export const updateVariantSchema = z.object({
  sku: z.string().min(1).max(128).optional(),
  status: z.nativeEnum(VariantStatus).optional(),
});

export const updateProductSchema = z.object({
  nameDefault: z.string().max(512).nullish(),
  status: z.nativeEnum(ProductStatus).optional(),
  visibility: z.nativeEnum(ProductVisibility).optional(),
  weight: decimalString.nullish(),
  attributeSetId: z.string().regex(/^\d+$/, 'expected numeric id').optional(),
  brandId: z.string().uuid().nullish(),
  taxClassId: z.string().regex(/^\d+$/, 'expected numeric id').nullish(),
  hsnCode: z.string().max(8).nullish(),
});

export const assignAttributeValueSchema = z.object({
  attributeCode: z.string().min(1),
  scope: z.nativeEnum(ScopeType),
  websiteId: z.string().regex(/^\d+$/).nullish(),
  storeId: z.string().regex(/^\d+$/).nullish(),
  storeViewId: z.string().regex(/^\d+$/).nullish(),
  value: z.unknown(),
});

export const assignAttributeValuesSchema = z.object({
  values: z
    .array(
      z.object({
        attributeCode: z.string().min(1),
        scope: z.nativeEnum(ScopeType).optional(),
        websiteId: z.string().regex(/^\d+$/).nullish(),
        storeId: z.string().regex(/^\d+$/).nullish(),
        storeViewId: z.string().regex(/^\d+$/).nullish(),
        value: z.unknown(),
      }),
    )
    .min(1),
});

export const storeViewQuerySchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'storeViewId query param required'),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  type: z.nativeEnum(ProductType).optional(),
  attributeSetId: z.string().regex(/^\d+$/, 'expected numeric id').optional(),
  search: z.string().min(1).optional(),
  sortBy: z.enum(['sku', 'nameDefault', 'createdAt', 'status']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
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

export const updateAttributeSchema = z.object({
  label: z.string().min(1).max(255).optional(),
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

export const createCategorySchema = z.object({
  parentId: z.string().uuid().nullish(),
  nameDefault: z.string().max(512).nullish(),
  type: z.nativeEnum(CategoryType).optional(),
  sortMode: z.nativeEnum(CategorySortMode).optional(),
  position: z.number().int().optional(),
});

export const updateCategorySchema = z.object({
  nameDefault: z.string().max(512).nullish(),
  sortMode: z.nativeEnum(CategorySortMode).optional(),
  position: z.number().int().optional(),
});

export const reparentCategorySchema = z.object({
  newParentId: z.string().uuid().nullable(),
});

export const setProductCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()),
});

export const createBrandSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullish(),
});

export const updateBrandSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullish(),
});

export const requestMediaUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
});

export const createMediaAssetSchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1).max(128),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const attachProductMediaSchema = z.object({
  mediaPublicId: z.string().uuid(),
  role: z.nativeEnum(ProductMediaRole).optional(),
});

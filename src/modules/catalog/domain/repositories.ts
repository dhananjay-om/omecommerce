import type { AttributeDataType, ScopeType } from '@prisma/client';
import type { Product } from './product.js';
import type { AttributeValueColumns } from './attribute-value.js';

/** Persistence port for the Product aggregate (implemented in infrastructure). */
export interface ProductRepository {
  existsBySku(sku: string): Promise<boolean>;
  create(product: Product): Promise<Product>;
  findByPublicId(publicId: string): Promise<Product | null>;
}

export interface AttributeInfo {
  id: bigint;
  code: string;
  dataType: AttributeDataType;
}

/** Read port for attribute definitions + scoped value writes/reads. */
export interface AttributeRepository {
  findByCode(code: string): Promise<AttributeInfo | null>;
}

export interface WriteScopedValueInput {
  productId: bigint;
  attributeId: bigint;
  scope: ScopeType;
  websiteId: bigint | null;
  storeId: bigint | null;
  storeViewId: bigint | null;
  columns: AttributeValueColumns;
}

export interface ResolvedAttribute {
  attributeId: bigint;
  code: string;
  dataType: AttributeDataType;
  columns: AttributeValueColumns;
}

/**
 * Scope-aware attribute value store. `resolveForStoreView` runs the single-pass
 * DISTINCT ON (attribute_id) ORDER BY scope_rank DESC query (plan/02 §5).
 */
export interface ProductAttributeStore {
  upsertScopedValue(input: WriteScopedValueInput): Promise<void>;
  resolveForStoreView(
    productId: bigint,
    chain: { websiteId: bigint; storeId: bigint; storeViewId: bigint },
  ): Promise<ResolvedAttribute[]>;
}

import { ProductType, ProductStatus, ProductVisibility } from '@prisma/client';
import { ValidationError } from '../../../shared/domain/errors.js';

export interface ProductProps {
  id: bigint | null;
  publicId: string | null;
  type: ProductType;
  sku: string;
  attributeSetId: bigint;
  status: ProductStatus;
  visibility: ProductVisibility;
  nameDefault: string | null;
  isDigital: boolean;
  isVirtual: boolean;
}

export interface CreateProductInput {
  type: ProductType;
  sku: string;
  attributeSetId: bigint;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  nameDefault?: string | null;
}

/**
 * Product aggregate root (plan/01 §3). Enforces the invariants that must hold
 * regardless of persistence. Digital/Virtual flags are DERIVED from type so they can
 * never disagree with it.
 */
export class Product {
  private constructor(public readonly props: ProductProps) {}

  static create(input: CreateProductInput): Product {
    const sku = input.sku?.trim();
    if (!sku) throw new ValidationError('sku is required', [{ path: 'sku', message: 'required' }]);
    if (sku.length > 128) {
      throw new ValidationError('sku too long', [{ path: 'sku', message: 'max 128 chars' }]);
    }
    if (!Object.values(ProductType).includes(input.type)) {
      throw new ValidationError('invalid product type', [{ path: 'type', message: 'invalid' }]);
    }
    return new Product({
      id: null,
      publicId: null,
      type: input.type,
      sku,
      attributeSetId: input.attributeSetId,
      status: input.status ?? ProductStatus.DRAFT,
      visibility: input.visibility ?? ProductVisibility.BOTH,
      nameDefault: input.nameDefault ?? null,
      isDigital: input.type === ProductType.DIGITAL,
      isVirtual: input.type === ProductType.VIRTUAL,
    });
  }

  /** Rehydrate from persistence (no invariant checks — trusted source). */
  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }
}

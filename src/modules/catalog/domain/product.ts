import { ProductType, ProductStatus, ProductVisibility } from '@prisma/client';
import { ValidationError } from '../../../shared/domain/errors.js';

export interface ProductProps {
  id: bigint | null;
  publicId: string | null;
  type: ProductType;
  sku: string;
  /** URL-safe storefront identifier (/{slug}.html) — resolved by CreateProduct
   *  BEFORE this constructor runs (uniqueSlug() needs an async repository
   *  lookup, which a pure domain factory can't do), same division of labor
   *  Category's slug already has between CreateCategory and Category.create(). */
  slug: string;
  attributeSetId: bigint;
  status: ProductStatus;
  visibility: ProductVisibility;
  nameDefault: string | null;
  weight: string | null;
  isDigital: boolean;
  isVirtual: boolean;
  /** GST rate class (src/modules/order's TaxClass, cross-aggregate scalar FK —
   *  same "scope scalar, FK added in raw SQL" convention as every other
   *  cross-module reference in this schema). Null = no GST charged (e.g.
   *  exempt goods) — see native-tax-calculator.ts's documented silent-zero behavior. */
  taxClassId: bigint | null;
  /** HSN (goods) / SAC (services) code — independent of taxClassId, a legal
   *  India GST invoice requirement. Snapshotted onto OrderLine at checkout. */
  hsnCode: string | null;
  /** Free-text merchandising tags — see Product.tags's own schema doc
   *  comment for why this is a plain string array, not a Tag entity. */
  tags: string[];
}

export interface CreateProductInput {
  type: ProductType;
  sku: string;
  slug: string;
  attributeSetId: bigint;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  nameDefault?: string | null;
  weight?: string | null;
  taxClassId?: bigint | null;
  hsnCode?: string | null;
  tags?: string[];
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
    const slug = input.slug?.trim();
    if (!slug) throw new ValidationError('slug is required', [{ path: 'slug', message: 'required' }]);
    return new Product({
      id: null,
      publicId: null,
      type: input.type,
      sku,
      slug,
      attributeSetId: input.attributeSetId,
      status: input.status ?? ProductStatus.DRAFT,
      visibility: input.visibility ?? ProductVisibility.BOTH,
      nameDefault: input.nameDefault ?? null,
      weight: input.weight ?? null,
      isDigital: input.type === ProductType.DIGITAL,
      isVirtual: input.type === ProductType.VIRTUAL,
      taxClassId: input.taxClassId ?? null,
      hsnCode: input.hsnCode ?? null,
      tags: input.tags ?? [],
    });
  }

  /** Rehydrate from persistence (no invariant checks — trusted source). */
  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }
}

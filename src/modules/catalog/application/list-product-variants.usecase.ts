import type { ProductRepository, ProductVariantRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { VariantView } from './dto.js';

/**
 * Admin browse endpoint (no prior endpoint exposed a variant's publicId at
 * all — confirmed gap, found while scoping the admin UI: everywhere else in
 * the codebase only resolves a variant BY publicId, never lists them).
 */
export class ListProductVariants {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
  ) {}

  async execute(productPublicId: string): Promise<VariantView[]> {
    const product = await this.products.findByPublicId(productPublicId);
    if (!product || product.props.id === null) {
      throw new NotFoundError('product', productPublicId);
    }
    return this.variants.listByProductId(product.props.id);
  }
}

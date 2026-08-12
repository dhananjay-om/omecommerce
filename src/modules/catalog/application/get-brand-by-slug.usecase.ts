import type { BrandRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toBrandView } from './brand-view.js';
import type { BrandView } from './dto.js';

/** Storefront brand page (plan/14 Phase 0b). */
export class GetBrandBySlug {
  constructor(private readonly brands: BrandRepository) {}

  async execute(slug: string): Promise<BrandView> {
    const brand = await this.brands.findBySlug(slug);
    if (!brand) throw new NotFoundError('brand', slug);
    return toBrandView(brand);
  }
}

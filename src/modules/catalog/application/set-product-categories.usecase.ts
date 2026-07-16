import type { ProductRepository, CategoryRepository, ProductCategoryRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { SetProductCategoriesCommand } from './dto.js';

/** Replaces a product's full assigned category set in one transaction (plan/13 Phase K). */
export class SetProductCategories {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly productCategories: ProductCategoryRepository,
  ) {}

  async execute(cmd: SetProductCategoriesCommand): Promise<void> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    const categoryIds: bigint[] = [];
    for (const publicId of cmd.categoryIds) {
      const category = await this.categories.findByPublicId(publicId);
      if (!category) throw new NotFoundError('category', publicId);
      categoryIds.push(category.id);
    }

    await this.productCategories.setForProduct(product.props.id, categoryIds);
  }
}

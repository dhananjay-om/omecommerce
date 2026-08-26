import type { ProductRepository, ProductMediaRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { UpdateProductMediaAltTextCommand } from './dto.js';

/** Sets/clears a product image's alt-text override — mirrors
 *  detach-product-media.usecase.ts's exact shape (resolve product, verify
 *  the media row actually belongs to it, then write). Manual edits and the
 *  AI Product Assistant's "Generate alt text" both go through this same
 *  path — the AI side never writes ProductMedia directly. */
export class UpdateProductMediaAltText {
  constructor(
    private readonly products: ProductRepository,
    private readonly productMedia: ProductMediaRepository,
  ) {}

  async execute(cmd: UpdateProductMediaAltTextCommand): Promise<void> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    const id = BigInt(cmd.productMediaId);
    const media = await this.productMedia.findById(id);
    if (!media || media.productId !== product.props.id) {
      throw new NotFoundError('product media', cmd.productMediaId);
    }

    await this.productMedia.updateAltOverride(id, cmd.altText);
  }
}

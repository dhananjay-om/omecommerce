import type { ProductRepository, ProductMediaRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { DetachProductMediaCommand } from './dto.js';

/** Detaches a ProductMedia row (does not delete the underlying MediaAsset, in case it's reused elsewhere — plan/13 Phase J). */
export class DetachProductMedia {
  constructor(
    private readonly products: ProductRepository,
    private readonly productMedia: ProductMediaRepository,
  ) {}

  async execute(cmd: DetachProductMediaCommand): Promise<void> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    const id = BigInt(cmd.productMediaId);
    const media = await this.productMedia.findById(id);
    if (!media || media.productId !== product.props.id) {
      throw new NotFoundError('product media', cmd.productMediaId);
    }

    await this.productMedia.detach(id);
  }
}

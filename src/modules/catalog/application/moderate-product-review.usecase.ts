import type { ProductRepository, ProductReviewRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { ModerateProductReviewCommand } from './dto.js';

/** Admin approve/reject — the ONLY place `isApproved` is ever set to
 *  `true` (SubmitProductReview always creates `false`). Setting it back
 *  to `false` is how an admin "rejects"/un-publishes an already-approved
 *  review — there's no separate delete/reject state, matching this
 *  system's existing preference for reversible toggles over destructive
 *  actions where a simple one suffices. */
export class ModerateProductReview {
  constructor(
    private readonly products: ProductRepository,
    private readonly reviews: ProductReviewRepository,
  ) {}

  async execute(cmd: ModerateProductReviewCommand): Promise<void> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    await this.reviews.setApproval(product.props.id, cmd.reviewPublicId, cmd.isApproved);
  }
}

import type { ProductRepository, ProductReviewRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
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
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: ModerateProductReviewCommand): Promise<void> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    await this.reviews.setApproval(product.props.id, cmd.reviewPublicId, cmd.isApproved);

    // The product's average rating / review count live in its search document
    // (product cards on the home page + listings), so an approve/reject has to
    // refresh it. Reuses ProductAttributeChanged — already in the indexer's
    // INDEXABLE_EVENTS, and IndexProduct recomputes everything on every run
    // (same reasoning as AttachProductMedia's own use of this event).
    await this.outbox.write({
      aggregateType: 'Product',
      aggregateId: cmd.productPublicId,
      eventType: 'ProductAttributeChanged',
      payload: { reason: 'review-moderated' },
    });
  }
}

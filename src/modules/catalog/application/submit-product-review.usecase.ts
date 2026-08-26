import type { ProductRepository, ProductReviewRepository, MediaStorage } from '../domain/repositories.js';
import type { CustomerNameLookup } from '../infrastructure/customer-name-lookup.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { SubmitProductReviewCommand, ProductReviewView } from './dto.js';

const MAX_IMAGES = 5;

/** Requires a real, logged-in customer (see catalog.module.ts's
 *  requireCustomer gate on this route) — `customerName` is snapshotted
 *  from their account at submission time, never accepted as free-typed
 *  input (would let anyone claim to be anyone). Always lands as
 *  `isApproved: false` (the repository/schema default) — this use case
 *  never sets it directly, so there's exactly one place a review can be
 *  approved (ModerateProductReview). `imageKeys` are storage keys from a
 *  prior POST /reviews/uploads round-trip (RequestReviewImageUpload) —
 *  this use case never receives raw file bytes. */
export class SubmitProductReview {
  constructor(
    private readonly products: ProductRepository,
    private readonly reviews: ProductReviewRepository,
    private readonly customers: CustomerNameLookup,
    private readonly storage: MediaStorage,
  ) {}

  async execute(cmd: SubmitProductReviewCommand): Promise<ProductReviewView> {
    if (!Number.isInteger(cmd.rating) || cmd.rating < 1 || cmd.rating > 5) {
      throw new ValidationError('rating must be an integer from 1 to 5', [{ path: 'rating', message: 'expected 1-5' }]);
    }
    if (cmd.imageKeys.length > MAX_IMAGES) {
      throw new ValidationError(`at most ${MAX_IMAGES} images per review`, [{ path: 'imageKeys', message: `at most ${MAX_IMAGES}` }]);
    }

    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    const customer = await this.customers.findByPublicId(cmd.customerPublicId);
    if (!customer) throw new NotFoundError('customer', cmd.customerPublicId);

    const created = await this.reviews.create({
      productId: product.props.id,
      customerId: customer.id,
      customerName: customer.displayName,
      rating: cmd.rating,
      title: cmd.title,
      body: cmd.body,
      imageKeys: cmd.imageKeys,
    });

    return {
      publicId: created.publicId,
      customerName: created.customerName,
      rating: created.rating,
      title: created.title,
      body: created.body,
      images: await Promise.all(created.imageKeys.map((k) => this.storage.presignGetUrl(k))),
      isApproved: created.isApproved,
      createdAt: created.createdAt.toISOString(),
    };
  }
}

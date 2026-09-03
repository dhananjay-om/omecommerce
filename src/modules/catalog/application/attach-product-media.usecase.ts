import type { ProductRepository, MediaAssetRepository, ProductMediaRepository, MediaStorage } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { AttachProductMediaCommand, ProductMediaView } from './dto.js';

/** Step 3 of the upload flow (plan/13 Phase J): attaches an already-registered MediaAsset to a product's gallery. */
export class AttachProductMedia {
  constructor(
    private readonly products: ProductRepository,
    private readonly mediaAssets: MediaAssetRepository,
    private readonly productMedia: ProductMediaRepository,
    private readonly storage: MediaStorage,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: AttachProductMediaCommand): Promise<ProductMediaView> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    const asset = await this.mediaAssets.findByPublicId(cmd.mediaPublicId);
    if (!asset) throw new NotFoundError('media asset', cmd.mediaPublicId);

    const attached = await this.productMedia.attach({ productId: product.props.id, assetId: asset.id, role: cmd.role });

    // A product is always created before its photos are uploaded, so ProductCreated's own
    // search-index write always has imageKey: null — nothing after that ever refreshed it,
    // so a product's search card (homepage carousels, PLP) stayed on the mock-photo fallback
    // forever even once real photos existed, confirmed live (a real, non-DEMO- SKU showing a
    // stock photo on the homepage while its own PDP correctly showed the real ones). Reuses
    // ProductAttributeChanged rather than a new event type — it's already in
    // search-indexer.worker.ts's INDEXABLE_EVENTS, and IndexProduct.execute() already
    // recomputes imageKey via productMedia.primaryImageKey() on every run regardless of what
    // actually changed, so no indexer-side change is needed for this to just work.
    await this.outbox.write({
      aggregateType: 'Product',
      aggregateId: cmd.productPublicId,
      eventType: 'ProductAttributeChanged',
      payload: { reason: 'media-attached' },
    });

    const url = await this.storage.presignGetUrl(attached.assetStorageKey);
    return {
      productMediaId: attached.id.toString(),
      url,
      role: attached.role,
      position: attached.position,
      altText: attached.altOverride ?? attached.assetAltDefault,
    };
  }
}

import type { ProductRepository, ProductMediaRepository, MediaStorage } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { SetProductThumbnailCommand, ProductMediaView } from './dto.js';

/**
 * Lets an admin pick which of a product's already-uploaded images is the
 * "main image" — the one used wherever only a single thumbnail is shown
 * (collection/PLP grid, search hits, mini-cart, cart line, admin grid).
 * Before this, `role` existed on the schema (GALLERY/THUMBNAIL/SWATCH/...)
 * but nothing in the product ever set THUMBNAIL, and every "one image"
 * lookup just fell back to whichever row happened to have the lowest
 * `position` — silently including SWATCH/VIDEO/DOCUMENT rows too.
 */
export class SetProductThumbnail {
  constructor(
    private readonly products: ProductRepository,
    private readonly productMedia: ProductMediaRepository,
    private readonly storage: MediaStorage,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(cmd: SetProductThumbnailCommand): Promise<ProductMediaView> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    const id = BigInt(cmd.productMediaId);
    const media = await this.productMedia.findById(id);
    if (!media || media.productId !== product.props.id) {
      throw new NotFoundError('product media', cmd.productMediaId);
    }

    await this.productMedia.setThumbnail(product.props.id, id);

    // The search index's imageKey is exactly "whichever image this use case designates the
    // thumbnail" (per this class's own doc comment — "search hits" is explicitly one of the
    // places this is meant to control) — changing it without reindexing would silently break
    // that promise the same way attaching/detaching media does.
    await this.outbox.write({
      aggregateType: 'Product',
      aggregateId: cmd.productPublicId,
      eventType: 'ProductAttributeChanged',
      payload: { reason: 'thumbnail-changed' },
    });

    const updated = await this.productMedia.findById(id);
    const url = await this.storage.presignGetUrl(updated!.assetStorageKey);
    return {
      productMediaId: updated!.id.toString(),
      url,
      role: updated!.role,
      position: updated!.position,
      altText: updated!.altOverride ?? updated!.assetAltDefault,
    };
  }
}

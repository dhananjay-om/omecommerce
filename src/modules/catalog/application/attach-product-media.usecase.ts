import type { ProductRepository, MediaAssetRepository, ProductMediaRepository, MediaStorage } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { AttachProductMediaCommand, ProductMediaView } from './dto.js';

/** Step 3 of the upload flow (plan/13 Phase J): attaches an already-registered MediaAsset to a product's gallery. */
export class AttachProductMedia {
  constructor(
    private readonly products: ProductRepository,
    private readonly mediaAssets: MediaAssetRepository,
    private readonly productMedia: ProductMediaRepository,
    private readonly storage: MediaStorage,
  ) {}

  async execute(cmd: AttachProductMediaCommand): Promise<ProductMediaView> {
    const product = await this.products.findByPublicId(cmd.productPublicId);
    if (!product || product.props.id === null) throw new NotFoundError('product', cmd.productPublicId);

    const asset = await this.mediaAssets.findByPublicId(cmd.mediaPublicId);
    if (!asset) throw new NotFoundError('media asset', cmd.mediaPublicId);

    const attached = await this.productMedia.attach({ productId: product.props.id, assetId: asset.id, role: cmd.role });
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

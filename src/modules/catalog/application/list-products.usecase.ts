import type { ProductRepository, ProductMediaRepository, MediaStorage } from '../domain/repositories.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { ListProductsQuery, ProductListView } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Admin browse (plan/12 Admin UI) — a real gap this pass fills: there was no way to list products via the API at all before. */
export class ListProducts {
  constructor(
    private readonly products: ProductRepository,
    private readonly productMedia: ProductMediaRepository,
    private readonly storage: MediaStorage,
  ) {}

  async execute(query: ListProductsQuery): Promise<ProductListView> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    let attributeSetId: bigint | undefined;
    if (query.attributeSetId !== undefined) {
      if (!/^\d+$/.test(query.attributeSetId)) {
        throw new ValidationError('invalid attributeSetId', [{ path: 'attributeSetId', message: 'expected numeric id' }]);
      }
      attributeSetId = BigInt(query.attributeSetId);
    }

    const result = await this.products.list({
      page,
      pageSize,
      status: query.status,
      type: query.type,
      attributeSetId,
      search: query.search,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });

    const thumbnailKeys = await this.productMedia.listThumbnailStorageKeysForProducts(result.products.map((p) => p.id));
    const thumbnailUrls = new Map<string, string>();
    await Promise.all(
      Array.from(thumbnailKeys.entries()).map(async ([productId, storageKey]) => {
        thumbnailUrls.set(productId, await this.storage.presignGetUrl(storageKey));
      }),
    );

    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      products: result.products.map((p) => ({
        publicId: p.publicId,
        sku: p.sku,
        name: p.name,
        type: p.type,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        quantity: p.quantity,
        salableQuantity: p.salableQuantity,
        thumbnailUrl: thumbnailUrls.get(p.id.toString()) ?? null,
        hasTaxClass: p.hasTaxClass,
      })),
    };
  }
}

import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  MediaAssetRepository,
  MediaAssetInfo,
  CreateMediaAssetInput,
  ProductMediaRepository,
  ProductMediaInfo,
  AttachProductMediaInput,
} from '../domain/repositories.js';

const MEDIA_ASSET_SELECT = { id: true, publicId: true, storageKey: true, mimeType: true, kind: true } as const;

/** Persistence adapter for the media registry (plan/13 Phase J) — bytes live in MinIO/S3, this table only tracks the storage key + metadata. */
export class PrismaMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateMediaAssetInput): Promise<MediaAssetInfo> {
    return this.db.mediaAsset.create({
      data: {
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        bytes: input.bytes,
        width: input.width,
        height: input.height,
        kind: input.kind,
      },
      select: MEDIA_ASSET_SELECT,
    });
  }

  async findByPublicId(publicId: string): Promise<MediaAssetInfo | null> {
    return this.db.mediaAsset.findFirst({ where: { publicId, deletedAt: null }, select: MEDIA_ASSET_SELECT });
  }
}

const PRODUCT_MEDIA_SELECT = {
  id: true,
  productId: true,
  role: true,
  position: true,
  altOverride: true,
  asset: { select: { storageKey: true, altDefault: true } },
} as const;

type ProductMediaRow = {
  id: bigint;
  productId: bigint;
  role: ProductMediaInfo['role'];
  position: number;
  altOverride: string | null;
  asset: { storageKey: string; altDefault: string | null };
};

function mapRow(row: ProductMediaRow): ProductMediaInfo {
  return {
    id: row.id,
    productId: row.productId,
    role: row.role,
    position: row.position,
    altOverride: row.altOverride,
    assetStorageKey: row.asset.storageKey,
    assetAltDefault: row.asset.altDefault,
  };
}

/** Persistence adapter for a product's attached media (plan/13 Phase J). */
export class PrismaProductMediaRepository implements ProductMediaRepository {
  constructor(private readonly db: Db) {}

  async attach(input: AttachProductMediaInput): Promise<ProductMediaInfo> {
    const agg = await this.db.productMedia.aggregate({ where: { productId: input.productId }, _max: { position: true } });
    const position = (agg._max.position ?? -1) + 1;
    const row = await this.db.productMedia.create({
      data: { productId: input.productId, assetId: input.assetId, role: input.role, position },
      select: PRODUCT_MEDIA_SELECT,
    });
    return mapRow(row);
  }

  async listForProduct(productId: bigint): Promise<ProductMediaInfo[]> {
    const rows = await this.db.productMedia.findMany({
      where: { productId },
      select: PRODUCT_MEDIA_SELECT,
      orderBy: { position: 'asc' },
    });
    return rows.map(mapRow);
  }

  async findById(id: bigint): Promise<ProductMediaInfo | null> {
    const row = await this.db.productMedia.findFirst({ where: { id }, select: PRODUCT_MEDIA_SELECT });
    return row ? mapRow(row) : null;
  }

  async detach(id: bigint): Promise<void> {
    await this.db.productMedia.delete({ where: { id } });
  }

  async listThumbnailStorageKeysForProducts(productIds: bigint[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (productIds.length === 0) return result;

    // A designated THUMBNAIL row always wins over plain gallery-position
    // ordering — `(pm.role = 'THUMBNAIL') DESC` sorts true before false.
    const rows = await this.db.$queryRaw<Array<{ product_id: bigint; storage_key: string }>>`
      SELECT DISTINCT ON (pm.product_id) pm.product_id AS product_id, ma.storage_key AS storage_key
        FROM product_media pm
        JOIN media_asset ma ON ma.id = pm.asset_id
       WHERE pm.product_id IN (${Prisma.join(productIds)})
         AND pm.role IN ('GALLERY', 'THUMBNAIL')
       ORDER BY pm.product_id, (pm.role = 'THUMBNAIL') DESC, pm.position ASC`;

    for (const row of rows) result.set(row.product_id.toString(), row.storage_key);
    return result;
  }

  async setThumbnail(productId: bigint, productMediaId: bigint): Promise<void> {
    await this.db.$transaction([
      this.db.productMedia.updateMany({ where: { productId, role: 'THUMBNAIL' }, data: { role: 'GALLERY' } }),
      this.db.productMedia.update({ where: { id: productMediaId }, data: { role: 'THUMBNAIL' } }),
    ]);
  }

  async updateAltOverride(id: bigint, altOverride: string | null): Promise<void> {
    await this.db.productMedia.update({ where: { id }, data: { altOverride } });
  }
}

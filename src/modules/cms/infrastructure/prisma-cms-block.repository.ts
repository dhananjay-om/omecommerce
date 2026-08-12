import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CmsBlockRepository, CmsBlockRecord, CreateCmsBlockInput, UpdateCmsBlockInput } from '../domain/repositories.js';

const BLOCK_SELECT = { publicId: true, storeViewId: true, code: true, body: true, status: true } as const;

export class PrismaCmsBlockRepository implements CmsBlockRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCmsBlockInput): Promise<CmsBlockRecord> {
    return this.db.cmsBlock.create({
      data: { storeViewId: input.storeViewId, code: input.code, body: input.body },
      select: BLOCK_SELECT,
    });
  }

  async findByPublicId(publicId: string): Promise<CmsBlockRecord | null> {
    return this.db.cmsBlock.findFirst({ where: { publicId }, select: BLOCK_SELECT });
  }

  async update(publicId: string, input: UpdateCmsBlockInput): Promise<CmsBlockRecord> {
    return this.db.cmsBlock.update({
      where: { publicId },
      data: { body: input.body, status: input.status },
      select: BLOCK_SELECT,
    });
  }

  async existsByStoreViewAndCode(storeViewId: bigint | null, code: string): Promise<boolean> {
    const found = await this.db.cmsBlock.findFirst({ where: { storeViewId, code }, select: { id: true } });
    return found !== null;
  }

  async resolveForStoreView(storeViewId: bigint, code: string): Promise<CmsBlockRecord | null> {
    const specific = await this.db.cmsBlock.findFirst({ where: { storeViewId, code }, select: BLOCK_SELECT });
    if (specific) return specific;
    return this.db.cmsBlock.findFirst({ where: { storeViewId: null, code }, select: BLOCK_SELECT });
  }
}

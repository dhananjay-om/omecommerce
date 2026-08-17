import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CmsPageRepository, CmsPageRecord, CreateCmsPageInput, UpdateCmsPageInput } from '../domain/repositories.js';

const PAGE_SELECT = {
  publicId: true,
  storeViewId: true,
  handle: true,
  title: true,
  body: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
} as const;

export class PrismaCmsPageRepository implements CmsPageRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCmsPageInput): Promise<CmsPageRecord> {
    return this.db.cmsPage.create({
      data: { storeViewId: input.storeViewId, handle: input.handle, title: input.title, body: input.body },
      select: PAGE_SELECT,
    });
  }

  async findByPublicId(publicId: string): Promise<CmsPageRecord | null> {
    return this.db.cmsPage.findFirst({ where: { publicId, deletedAt: null }, select: PAGE_SELECT });
  }

  async list(): Promise<CmsPageRecord[]> {
    return this.db.cmsPage.findMany({ where: { deletedAt: null }, select: PAGE_SELECT, orderBy: { updatedAt: 'desc' } });
  }

  async softDelete(publicId: string): Promise<void> {
    await this.db.cmsPage.update({ where: { publicId }, data: { deletedAt: new Date() } });
  }

  async update(publicId: string, input: UpdateCmsPageInput): Promise<CmsPageRecord> {
    return this.db.cmsPage.update({
      where: { publicId },
      data: {
        title: input.title,
        body: input.body,
        status: input.status,
        // Immediate-flip publish model (documented deferral: no scheduled
        // publish yet) — every transition INTO PUBLISHED stamps publishedAt
        // with the current time; unpublishing leaves the prior timestamp as a
        // harmless "last published at" historical marker.
        ...(input.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
      select: PAGE_SELECT,
    });
  }

  async existsByStoreViewAndHandle(storeViewId: bigint | null, handle: string): Promise<boolean> {
    const found = await this.db.cmsPage.findFirst({ where: { storeViewId, handle, deletedAt: null }, select: { id: true } });
    return found !== null;
  }

  async resolveForStoreView(storeViewId: bigint, handle: string): Promise<CmsPageRecord | null> {
    const specific = await this.db.cmsPage.findFirst({ where: { storeViewId, handle, deletedAt: null }, select: PAGE_SELECT });
    if (specific) return specific;
    return this.db.cmsPage.findFirst({ where: { storeViewId: null, handle, deletedAt: null }, select: PAGE_SELECT });
  }
}

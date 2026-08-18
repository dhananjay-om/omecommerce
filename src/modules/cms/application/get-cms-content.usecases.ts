import type { CmsPageRepository, CmsBlockRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { resolveInlineImages } from './resolve-inline-images.js';
import type { CmsPageView, CmsBlockView } from './dto.js';

function parseStoreViewId(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

/** Store-view-specific row first, falling back to the global row; 404 unless the resolved row is PUBLISHED. */
export class GetCmsPage {
  constructor(private readonly pages: CmsPageRepository) {}

  async execute(handle: string, storeViewId: string): Promise<CmsPageView> {
    const page = await this.pages.resolveForStoreView(parseStoreViewId(storeViewId), handle);
    if (!page || page.status !== 'PUBLISHED') {
      throw new NotFoundError('CMS page', handle);
    }
    return {
      publicId: page.publicId,
      handle: page.handle,
      title: page.title,
      body: await resolveInlineImages(page.body),
      status: page.status,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      updatedAt: page.updatedAt.toISOString(),
    };
  }
}

export class GetCmsBlock {
  constructor(private readonly blocks: CmsBlockRepository) {}

  async execute(code: string, storeViewId: string): Promise<CmsBlockView> {
    const block = await this.blocks.resolveForStoreView(parseStoreViewId(storeViewId), code);
    if (!block || block.status !== 'PUBLISHED') {
      throw new NotFoundError('CMS block', code);
    }
    return {
      publicId: block.publicId,
      code: block.code,
      body: await resolveInlineImages(block.body),
      status: block.status,
      updatedAt: block.updatedAt.toISOString(),
    };
  }
}

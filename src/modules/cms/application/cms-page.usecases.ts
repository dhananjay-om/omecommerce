import type { CmsPageRepository } from '../domain/repositories.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { resolveInlineImages } from './resolve-inline-images.js';
import type { CreateCmsPageCommand, UpdateCmsPageCommand, CmsPageView } from './dto.js';

function parseStoreViewId(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  if (!/^\d+$/.test(value)) {
    throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

/** Async since it resolves any inline `data-media-key` images in `body`
 *  to fresh presigned URLs — see resolve-inline-images.ts. */
async function toView(p: {
  publicId: string;
  handle: string;
  title: string;
  body: string;
  status: CmsPageView['status'];
  publishedAt: Date | null;
  updatedAt: Date;
}): Promise<CmsPageView> {
  return {
    publicId: p.publicId,
    handle: p.handle,
    title: p.title,
    body: await resolveInlineImages(p.body),
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export class CreateCmsPage {
  constructor(private readonly pages: CmsPageRepository) {}

  async execute(cmd: CreateCmsPageCommand): Promise<CmsPageView> {
    const storeViewId = parseStoreViewId(cmd.storeViewId);
    const handle = cmd.handle.trim();
    if (await this.pages.existsByStoreViewAndHandle(storeViewId, handle)) {
      throw new ConflictError(`CMS page already exists for this handle/store view: ${handle}`);
    }
    const page = await this.pages.create({ storeViewId, handle, title: cmd.title, body: cmd.body });
    return toView(page);
  }
}

export class UpdateCmsPage {
  constructor(private readonly pages: CmsPageRepository) {}

  async execute(publicId: string, cmd: UpdateCmsPageCommand): Promise<CmsPageView> {
    if (!(await this.pages.findByPublicId(publicId))) {
      throw new NotFoundError('CMS page', publicId);
    }
    const page = await this.pages.update(publicId, cmd);
    return toView(page);
  }
}

/** Admin browse (Content > Pages). */
export class ListCmsPages {
  constructor(private readonly pages: CmsPageRepository) {}

  async execute(): Promise<CmsPageView[]> {
    const rows = await this.pages.list();
    return Promise.all(rows.map(toView));
  }
}

export class GetCmsPageByPublicId {
  constructor(private readonly pages: CmsPageRepository) {}

  async execute(publicId: string): Promise<CmsPageView> {
    const page = await this.pages.findByPublicId(publicId);
    if (!page) throw new NotFoundError('CMS page', publicId);
    return toView(page);
  }
}

export class DeleteCmsPage {
  constructor(private readonly pages: CmsPageRepository) {}

  async execute(publicId: string): Promise<void> {
    if (!(await this.pages.findByPublicId(publicId))) {
      throw new NotFoundError('CMS page', publicId);
    }
    await this.pages.softDelete(publicId);
  }
}

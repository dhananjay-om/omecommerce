import type { CmsBlockRepository } from '../domain/repositories.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateCmsBlockCommand, UpdateCmsBlockCommand, CmsBlockView } from './dto.js';

function parseStoreViewId(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  if (!/^\d+$/.test(value)) {
    throw new ValidationError('invalid storeViewId', [{ path: 'storeViewId', message: 'expected numeric id' }]);
  }
  return BigInt(value);
}

function toView(b: { publicId: string; code: string; body: string; status: CmsBlockView['status']; updatedAt: Date }): CmsBlockView {
  return { publicId: b.publicId, code: b.code, body: b.body, status: b.status, updatedAt: b.updatedAt.toISOString() };
}

export class CreateCmsBlock {
  constructor(private readonly blocks: CmsBlockRepository) {}

  async execute(cmd: CreateCmsBlockCommand): Promise<CmsBlockView> {
    const storeViewId = parseStoreViewId(cmd.storeViewId);
    const code = cmd.code.trim();
    if (await this.blocks.existsByStoreViewAndCode(storeViewId, code)) {
      throw new ConflictError(`CMS block already exists for this code/store view: ${code}`);
    }
    const block = await this.blocks.create({ storeViewId, code, body: cmd.body });
    return toView(block);
  }
}

export class UpdateCmsBlock {
  constructor(private readonly blocks: CmsBlockRepository) {}

  async execute(publicId: string, cmd: UpdateCmsBlockCommand): Promise<CmsBlockView> {
    if (!(await this.blocks.findByPublicId(publicId))) {
      throw new NotFoundError('CMS block', publicId);
    }
    const block = await this.blocks.update(publicId, cmd);
    return toView(block);
  }
}

/** Admin browse (Content > Blocks). */
export class ListCmsBlocks {
  constructor(private readonly blocks: CmsBlockRepository) {}

  async execute(): Promise<CmsBlockView[]> {
    const rows = await this.blocks.list();
    return rows.map(toView);
  }
}

export class GetCmsBlockByPublicId {
  constructor(private readonly blocks: CmsBlockRepository) {}

  async execute(publicId: string): Promise<CmsBlockView> {
    const block = await this.blocks.findByPublicId(publicId);
    if (!block) throw new NotFoundError('CMS block', publicId);
    return toView(block);
  }
}

export class DeleteCmsBlock {
  constructor(private readonly blocks: CmsBlockRepository) {}

  async execute(publicId: string): Promise<void> {
    if (!(await this.blocks.findByPublicId(publicId))) {
      throw new NotFoundError('CMS block', publicId);
    }
    await this.blocks.softDelete(publicId);
  }
}

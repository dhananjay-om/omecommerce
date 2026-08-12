import type { BrandRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { toBrandView } from './brand-view.js';
import type { UpdateBrandCommand, BrandView } from './dto.js';

export class UpdateBrand {
  constructor(private readonly brands: BrandRepository) {}

  async execute(cmd: UpdateBrandCommand): Promise<BrandView> {
    const existing = await this.brands.findByPublicId(cmd.publicId);
    if (!existing) throw new NotFoundError('brand', cmd.publicId);

    const updated = await this.brands.update(existing.id, { name: cmd.name, description: cmd.description });
    return toBrandView(updated);
  }
}

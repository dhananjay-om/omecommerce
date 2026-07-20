import type { BrandRepository } from '../domain/repositories.js';
import { toBrandView } from './brand-view.js';
import { uniqueSlug } from './slugify.js';
import type { CreateBrandCommand, BrandView } from './dto.js';

export class CreateBrand {
  constructor(private readonly brands: BrandRepository) {}

  async execute(cmd: CreateBrandCommand): Promise<BrandView> {
    const slug = await uniqueSlug((s) => this.brands.findBySlug(s), cmd.name, 'brand');
    const created = await this.brands.create({ slug, name: cmd.name, description: cmd.description });
    return toBrandView(created);
  }
}

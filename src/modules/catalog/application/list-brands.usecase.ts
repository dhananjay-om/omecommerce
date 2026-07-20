import type { BrandRepository } from '../domain/repositories.js';
import { toBrandView } from './brand-view.js';
import type { BrandView } from './dto.js';

/** Admin browse + storefront browse (plan/14 Phase 0b) — same endpoint shape reused by both `admin` and `store` routers. */
export class ListBrands {
  constructor(private readonly brands: BrandRepository) {}

  async execute(): Promise<BrandView[]> {
    const rows = await this.brands.list();
    return rows.map(toBrandView);
  }
}

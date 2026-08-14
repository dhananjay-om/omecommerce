import type { CouponRepository, ProductLookup, CategoryLookup, AttributeLookup } from '../domain/repositories.js';
import type { CouponView } from './dto.js';
import { toView } from './to-view.js';

export class ListCoupons {
  constructor(
    private readonly coupons: CouponRepository,
    private readonly products: ProductLookup,
    private readonly categories: CategoryLookup,
    private readonly attributes: AttributeLookup,
  ) {}

  async execute(): Promise<CouponView[]> {
    const rows = await this.coupons.list();
    return Promise.all(rows.map((c) => toView(c, { products: this.products, categories: this.categories, attributes: this.attributes })));
  }
}

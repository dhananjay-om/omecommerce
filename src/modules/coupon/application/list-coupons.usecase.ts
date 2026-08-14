import type { CouponRepository } from '../domain/repositories.js';
import type { CouponView } from './dto.js';
import { toView } from './to-view.js';

export class ListCoupons {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(): Promise<CouponView[]> {
    const rows = await this.coupons.list();
    return rows.map(toView);
  }
}

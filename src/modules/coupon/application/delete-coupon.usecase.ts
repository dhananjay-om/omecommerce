import type { CouponRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/** Soft-delete: sets deletedAt. Unlike Currency (hard-deleted, blocked by a real DB
 *  FK when in use), a coupon's CouponRedemption rows have no FK-driven reason to
 *  block this — a deleted coupon just stops resolving in evaluate() (findByCode
 *  is filtered by the shared soft-delete extension), same as deactivating it. Its
 *  redemption history is kept, not cascaded — the admin audit trail survives. */
export class DeleteCoupon {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(code: string): Promise<void> {
    const existing = await this.coupons.findByCode(code);
    if (!existing) throw new NotFoundError('Coupon', code);
    await this.coupons.softDelete(code);
  }
}

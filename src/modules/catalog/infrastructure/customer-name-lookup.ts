import type { Db } from '../../../shared/infrastructure/prisma/client.js';

export interface CustomerNameLookupResult {
  id: bigint;
  displayName: string;
}

/** Read-only cross-module lookup: own trivial copy, not Customer module's
 *  repository — same "own copy, not a real dependency" posture as
 *  wishlist's own PrismaCustomerLookup (src/modules/wishlist/
 *  infrastructure/lookups.ts). Resolves the JWT's customerPublicId to an
 *  internal id + a display name snapshotted at review-submission time
 *  (see ProductReview.customerName's own doc comment for why this isn't
 *  a live join). */
export class CustomerNameLookup {
  constructor(private readonly db: Db) {}

  async findByPublicId(customerPublicId: string): Promise<CustomerNameLookupResult | null> {
    const row = await this.db.customer.findFirst({
      where: { publicId: customerPublicId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!row) return null;
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    return { id: row.id, displayName: name || row.email };
  }
}

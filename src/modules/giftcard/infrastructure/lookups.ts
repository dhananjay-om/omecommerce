import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WebsiteLookup, CustomerLookup } from '../domain/repositories.js';

/** Read-only cross-module lookup: own trivial copy, matching pricing/customer modules' PrismaWebsiteLookup pattern. */
export class PrismaWebsiteLookup implements WebsiteLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint; baseCurrency: string } | null> {
    return this.db.website.findFirst({ where: { code }, select: { id: true, baseCurrency: true } });
  }
}

/** Read-only cross-module lookup: own trivial copy, not Customer module's repository. */
export class PrismaCustomerLookup implements CustomerLookup {
  constructor(private readonly db: Db) {}

  async findIdByPublicId(customerPublicId: string): Promise<bigint | null> {
    const row = await this.db.customer.findFirst({ where: { publicId: customerPublicId }, select: { id: true } });
    return row?.id ?? null;
  }
}

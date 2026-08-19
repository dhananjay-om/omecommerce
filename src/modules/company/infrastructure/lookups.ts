import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WebsiteLookup, CustomerLookup, CustomerGroupLookup } from '../domain/repositories.js';

/** Read-only cross-module lookup: own trivial copy, matching giftcard/loyalty modules' identical-purpose lookup. */
export class PrismaWebsiteLookup implements WebsiteLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.website.findFirst({ where: { code }, select: { id: true } });
  }

  async byId(id: bigint): Promise<{ code: string; baseCurrency: string } | null> {
    return this.db.website.findFirst({ where: { id }, select: { code: true, baseCurrency: true } });
  }
}

/** Read-only cross-module lookup: own trivial copy, not Customer module's repository. */
export class PrismaCustomerLookup implements CustomerLookup {
  constructor(private readonly db: Db) {}

  async findIdByPublicId(customerPublicId: string): Promise<bigint | null> {
    const row = await this.db.customer.findFirst({ where: { publicId: customerPublicId, deletedAt: null }, select: { id: true } });
    return row?.id ?? null;
  }

  async findByWebsiteAndEmail(websiteId: bigint, email: string): Promise<{ id: bigint; publicId: string } | null> {
    return this.db.customer.findFirst({ where: { websiteId, email, deletedAt: null }, select: { id: true, publicId: true } });
  }

  async byId(customerId: bigint): Promise<{ publicId: string; email: string; websiteId: bigint } | null> {
    return this.db.customer.findFirst({ where: { id: customerId, deletedAt: null }, select: { publicId: true, email: true, websiteId: true } });
  }
}

/** Read-only cross-module lookup: own trivial copy, not Pricing/Order module's repository. */
export class PrismaCustomerGroupLookup implements CustomerGroupLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.customerGroup.findFirst({ where: { code, deletedAt: null }, select: { id: true } });
  }

  async byId(id: bigint): Promise<{ code: string; name: string } | null> {
    return this.db.customerGroup.findFirst({ where: { id, deletedAt: null }, select: { code: true, name: true } });
  }
}

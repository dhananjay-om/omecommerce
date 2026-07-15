import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ProductExistenceLookup, CustomerLookup } from '../domain/repositories.js';

/** Read-only cross-module lookup: own trivial copy, not Catalog's ProductLookup. */
export class PrismaProductExistenceLookup implements ProductExistenceLookup {
  constructor(private readonly db: Db) {}

  async findByPublicId(publicId: string): Promise<{ id: bigint } | null> {
    return this.db.product.findFirst({ where: { publicId }, select: { id: true } });
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

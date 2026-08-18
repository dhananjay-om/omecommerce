import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CustomerLookup } from '../domain/repositories.js';

/** Read-only cross-module lookup: own trivial copy, not Customer module's repository. */
export class PrismaCustomerLookup implements CustomerLookup {
  constructor(private readonly db: Db) {}

  async findIdByPublicId(customerPublicId: string): Promise<bigint | null> {
    const row = await this.db.customer.findFirst({ where: { publicId: customerPublicId }, select: { id: true } });
    return row?.id ?? null;
  }

  async findPublicIdById(customerId: bigint): Promise<string | null> {
    const row = await this.db.customer.findFirst({ where: { id: customerId }, select: { publicId: true } });
    return row?.publicId ?? null;
  }

  async findGroupIdByCustomerId(customerId: bigint): Promise<bigint | null> {
    const row = await this.db.customer.findFirst({ where: { id: customerId }, select: { customerGroupId: true } });
    return row?.customerGroupId ?? null;
  }
}

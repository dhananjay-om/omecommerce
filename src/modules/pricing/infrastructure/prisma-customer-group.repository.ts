import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  CustomerGroupRepository,
  CustomerGroupInfo,
  CreateCustomerGroupInput,
  VariantLookup,
  WebsiteLookup,
} from '../domain/repositories.js';

export class PrismaCustomerGroupRepository implements CustomerGroupRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCustomerGroupInput): Promise<CustomerGroupInfo> {
    const row = await this.db.customerGroup.create({
      data: { code: input.code, name: input.name, isDefault: input.isDefault },
    });
    return { id: row.id, publicId: row.publicId, code: row.code, name: row.name };
  }

  async findByCode(code: string): Promise<CustomerGroupInfo | null> {
    const row = await this.db.customerGroup.findFirst({ where: { code } });
    return row ? { id: row.id, publicId: row.publicId, code: row.code, name: row.name } : null;
  }
}

/** Read-only cross-module lookup: resolves a catalog variant's publicId. */
export class PrismaVariantLookup implements VariantLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<{ id: bigint } | null> {
    return this.db.productVariant.findFirst({ where: { publicId }, select: { id: true } });
  }
}

/** Read-only cross-module lookup: resolves a store website's code. */
export class PrismaWebsiteLookup implements WebsiteLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.website.findFirst({ where: { code }, select: { id: true } });
  }
}

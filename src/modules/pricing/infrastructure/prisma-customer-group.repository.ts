import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  CustomerGroupRepository,
  CustomerGroupInfo,
  CreateCustomerGroupInput,
  VariantLookup,
  WebsiteLookup,
  CurrencyLookup,
} from '../domain/repositories.js';

export class PrismaCustomerGroupRepository implements CustomerGroupRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCustomerGroupInput): Promise<CustomerGroupInfo> {
    const row = await this.db.customerGroup.create({
      data: { code: input.code, name: input.name, isDefault: input.isDefault },
    });
    return toInfo(row);
  }

  async findByCode(code: string): Promise<CustomerGroupInfo | null> {
    const row = await this.db.customerGroup.findFirst({ where: { code } });
    return row ? toInfo(row) : null;
  }

  async list(): Promise<CustomerGroupInfo[]> {
    const rows = await this.db.customerGroup.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' } });
    return rows.map(toInfo);
  }
}

function toInfo(row: { id: bigint; publicId: string; code: string; name: string; isDefault: boolean }): CustomerGroupInfo {
  return { id: row.id, publicId: row.publicId, code: row.code, name: row.name, isDefault: row.isDefault };
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

/** Read-only cross-module lookup: resolves a registered currency code. */
export class PrismaCurrencyLookup implements CurrencyLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ code: string } | null> {
    return this.db.currency.findUnique({ where: { code }, select: { code: true } });
  }
}

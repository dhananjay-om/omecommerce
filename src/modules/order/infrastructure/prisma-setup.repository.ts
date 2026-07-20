import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { TaxClassRepository, ShippingMethodRepository } from '../domain/repositories.js';

export class PrismaTaxClassRepository implements TaxClassRepository {
  constructor(private readonly db: Db) {}

  async create(input: { code: string; name: string; rate: string }): Promise<{ publicId: string; code: string }> {
    const row = await this.db.taxClass.create({ data: input });
    return { publicId: row.publicId, code: row.code };
  }

  async findByCode(code: string): Promise<{ id: bigint; code: string } | null> {
    return this.db.taxClass.findFirst({ where: { code }, select: { id: true, code: true } });
  }
}

export class PrismaShippingMethodRepository implements ShippingMethodRepository {
  constructor(private readonly db: Db) {}

  async create(input: {
    code: string;
    name: string;
    flatRate: string;
    currency: string;
  }): Promise<{ publicId: string; code: string }> {
    const row = await this.db.shippingMethod.create({ data: input });
    return { publicId: row.publicId, code: row.code };
  }

  async findByCode(code: string): Promise<{ id: bigint; code: string } | null> {
    return this.db.shippingMethod.findFirst({ where: { code }, select: { id: true, code: true } });
  }

  async list(currency: string): Promise<Array<{ code: string; name: string; flatRate: string; currency: string }>> {
    const rows = await this.db.shippingMethod.findMany({
      where: { currency },
      select: { code: true, name: true, flatRate: true, currency: true },
      orderBy: { flatRate: 'asc' },
    });
    return rows.map((r) => ({ code: r.code, name: r.name, flatRate: r.flatRate.toString(), currency: r.currency }));
  }
}

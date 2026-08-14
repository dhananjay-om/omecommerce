import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { TaxClassRepository, TaxClassAdminInfo, ShippingMethodRepository } from '../domain/repositories.js';
import { toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';

// Prisma's Decimal.toString() strips trailing zeros ("0.1800" -> "0.18"); this
// round-trip through the fixed-point minor-units helpers restores the padded
// scale-4 string, same fix already applied in the coupon/pricing repositories.
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

function toAdminInfo(row: {
  id: { toString(): string };
  publicId: string;
  code: string;
  name: string;
  rate: { toString(): string };
  isActive: boolean;
}): TaxClassAdminInfo {
  return { id: row.id.toString(), publicId: row.publicId, code: row.code, name: row.name, rate: formatDecimal(row.rate), isActive: row.isActive };
}

export class PrismaTaxClassRepository implements TaxClassRepository {
  constructor(private readonly db: Db) {}

  async create(input: { code: string; name: string; rate: string }): Promise<TaxClassAdminInfo> {
    const row = await this.db.taxClass.create({ data: input });
    return toAdminInfo(row);
  }

  async findByCode(code: string): Promise<TaxClassAdminInfo | null> {
    const row = await this.db.taxClass.findFirst({ where: { code } });
    return row ? toAdminInfo(row) : null;
  }

  async list(): Promise<TaxClassAdminInfo[]> {
    const rows = await this.db.taxClass.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toAdminInfo);
  }

  async update(code: string, input: { name?: string; rate?: string; isActive?: boolean }): Promise<TaxClassAdminInfo> {
    const row = await this.db.taxClass.update({ where: { code }, data: input });
    return toAdminInfo(row);
  }

  async softDelete(code: string): Promise<void> {
    // The shared soft-delete extension (shared/infrastructure/prisma/client.ts)
    // remaps this delete() into an UPDATE deletedAt = now() automatically.
    await this.db.taxClass.delete({ where: { code } });
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

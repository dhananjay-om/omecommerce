import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  TaxClassRepository,
  TaxClassAdminInfo,
  ShippingMethodRepository,
  ShippingMethodAdminInfo,
  PaymentMethodRepository,
  PaymentMethodAdminInfo,
} from '../domain/repositories.js';
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

function toShippingAdminInfo(row: {
  publicId: string;
  code: string;
  name: string;
  flatRate: { toString(): string };
  currency: string;
  isActive: boolean;
}): ShippingMethodAdminInfo {
  return {
    publicId: row.publicId,
    code: row.code,
    name: row.name,
    flatRate: formatDecimal(row.flatRate),
    currency: row.currency,
    isActive: row.isActive,
  };
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
      // isActive filtered explicitly — deactivating a method in the admin (isActive: false)
      // must actually stop offering it at checkout, not just hide it from the admin list.
      where: { currency, isActive: true },
      select: { code: true, name: true, flatRate: true, currency: true },
      orderBy: { flatRate: 'asc' },
    });
    return rows.map((r) => ({ code: r.code, name: r.name, flatRate: r.flatRate.toString(), currency: r.currency }));
  }

  async listAll(): Promise<ShippingMethodAdminInfo[]> {
    const rows = await this.db.shippingMethod.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toShippingAdminInfo);
  }

  async update(code: string, input: { name?: string; flatRate?: string; isActive?: boolean }): Promise<ShippingMethodAdminInfo> {
    const row = await this.db.shippingMethod.update({ where: { code }, data: input });
    return toShippingAdminInfo(row);
  }

  async softDelete(code: string): Promise<void> {
    // Remapped into an UPDATE deletedAt = now() by the shared soft-delete extension, same as
    // PrismaTaxClassRepository.softDelete above.
    await this.db.shippingMethod.delete({ where: { code } });
  }
}

function toPaymentAdminInfo(row: {
  publicId: string;
  code: string;
  name: string;
  type: PaymentMethodAdminInfo['type'];
  isActive: boolean;
}): PaymentMethodAdminInfo {
  return { publicId: row.publicId, code: row.code, name: row.name, type: row.type, isActive: row.isActive };
}

export class PrismaPaymentMethodRepository implements PaymentMethodRepository {
  constructor(private readonly db: Db) {}

  async create(input: { code: string; name: string; type: PaymentMethodAdminInfo['type'] }): Promise<{ publicId: string; code: string }> {
    const row = await this.db.paymentMethod.create({ data: input });
    return { publicId: row.publicId, code: row.code };
  }

  async findByCode(code: string): Promise<PaymentMethodAdminInfo | null> {
    const row = await this.db.paymentMethod.findFirst({ where: { code } });
    return row ? toPaymentAdminInfo(row) : null;
  }

  async list(): Promise<Array<{ code: string; name: string; type: PaymentMethodAdminInfo['type'] }>> {
    const rows = await this.db.paymentMethod.findMany({
      where: { isActive: true },
      select: { code: true, name: true, type: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows;
  }

  async listAll(): Promise<PaymentMethodAdminInfo[]> {
    const rows = await this.db.paymentMethod.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toPaymentAdminInfo);
  }

  async update(code: string, input: { name?: string; isActive?: boolean }): Promise<PaymentMethodAdminInfo> {
    const row = await this.db.paymentMethod.update({ where: { code }, data: input });
    return toPaymentAdminInfo(row);
  }

  async softDelete(code: string): Promise<void> {
    // Remapped into an UPDATE deletedAt = now() by the shared soft-delete extension, same as
    // PrismaTaxClassRepository.softDelete above.
    await this.db.paymentMethod.delete({ where: { code } });
  }
}

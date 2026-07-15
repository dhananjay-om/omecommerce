import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { CustomerContextLookup, CustomerContext, OrderLookup, OrderContext } from '../domain/repositories.js';
import type { WebsiteLookup } from '../application/create-loyalty-program.usecase.js';

function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

/** Read-only cross-module lookup: a customer's own website + that website's base currency (own trivial copy, matching Wallet's identical-purpose lookup). */
export class PrismaCustomerContextLookup implements CustomerContextLookup {
  constructor(private readonly db: Db) {}

  async resolveByPublicId(customerPublicId: string): Promise<CustomerContext | null> {
    const customer = await this.db.customer.findFirst({ where: { publicId: customerPublicId }, select: { id: true, websiteId: true } });
    if (!customer) return null;
    const website = await this.db.website.findFirst({ where: { id: customer.websiteId }, select: { baseCurrency: true } });
    if (!website) return null;
    return { customerId: customer.id, websiteId: customer.websiteId, currency: website.baseCurrency };
  }
}

/** Read-only cross-module lookup: own trivial copy, used only by the loyalty-earn worker (not Order module's repository). */
export class PrismaOrderLookup implements OrderLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(orderPublicId: string): Promise<OrderContext | null> {
    const row = await this.db.order.findFirst({
      where: { publicId: orderPublicId },
      select: { id: true, publicId: true, customerId: true, websiteId: true, grandTotal: true, status: true },
    });
    if (!row) return null;
    return { id: row.id, publicId: row.publicId, customerId: row.customerId, websiteId: row.websiteId, grandTotal: formatDecimal(row.grandTotal), status: row.status };
  }
}

/** Read-only cross-module lookup: own trivial copy, matching pricing/customer/giftcard modules' identical PrismaWebsiteLookup. */
export class PrismaWebsiteLookup implements WebsiteLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.website.findFirst({ where: { code }, select: { id: true } });
  }
}

/** Read-only cross-module lookup: own trivial copy (not wallet/giftcard modules' identical PrismaAdminUserLookup). */
export class PrismaAdminUserLookup {
  constructor(private readonly db: Db) {}

  async findIdByPublicId(adminUserPublicId: string): Promise<bigint | null> {
    const row = await this.db.adminUser.findFirst({ where: { publicId: adminUserPublicId }, select: { id: true } });
    return row?.id ?? null;
  }
}

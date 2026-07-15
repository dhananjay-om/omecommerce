import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { CustomerOrderLookup, CustomerOrderSummary } from '../domain/repositories.js';

// Prisma's Decimal.toString() strips trailing zeros ("100.0000" -> "100"); this
// round-trip through the fixed-point minor-units helpers restores the scale-4
// string, same fix as order module's own formatDecimal (prisma-order.repository.ts).
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

/** Read-only cross-module lookup: a customer's own order history, reading `order` rows directly (trivial read, not the full Order module repository). */
export class PrismaCustomerOrderLookup implements CustomerOrderLookup {
  constructor(private readonly db: Db) {}

  async listByCustomerId(customerId: bigint): Promise<CustomerOrderSummary[]> {
    const rows = await this.db.order.findMany({
      where: { customerId },
      select: {
        publicId: true,
        orderNumber: true,
        status: true,
        financialStatus: true,
        fulfillmentStatus: true,
        grandTotal: true,
        currency: true,
        placedAt: true,
      },
      orderBy: { placedAt: 'desc' },
    });
    return rows.map((r) => ({
      publicId: r.publicId,
      orderNumber: r.orderNumber.toString(),
      status: r.status,
      financialStatus: r.financialStatus,
      fulfillmentStatus: r.fulfillmentStatus,
      grandTotal: formatDecimal(r.grandTotal),
      currency: r.currency,
      placedAt: r.placedAt,
    }));
  }
}

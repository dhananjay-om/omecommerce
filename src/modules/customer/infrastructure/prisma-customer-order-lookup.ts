import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { CustomerOrderLookup, ListCustomerOrdersFilter, CustomerOrderListResult } from '../domain/repositories.js';

// Prisma's Decimal.toString() strips trailing zeros ("100.0000" -> "100"); this
// round-trip through the fixed-point minor-units helpers restores the scale-4
// string, same fix as order module's own formatDecimal (prisma-order.repository.ts).
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

/** Read-only cross-module lookup: a customer's own order history, reading `order` rows directly (trivial read, not the full Order module repository). */
export class PrismaCustomerOrderLookup implements CustomerOrderLookup {
  constructor(private readonly db: Db) {}

  async list(customerId: bigint, filter: ListCustomerOrdersFilter): Promise<CustomerOrderListResult> {
    const conditions: Prisma.Sql[] = [Prisma.sql`o.customer_id = ${customerId}`];
    if (filter.search) conditions.push(Prisma.sql`o.order_number::text ILIKE ${`${filter.search}%`}`);
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const fromJoin = Prisma.sql`
      FROM "order" o
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(qty), 0)::int AS items_count FROM order_line WHERE order_line.order_id = o.id
      ) li ON true
      ${where}`;

    const [countRows, rows] = await Promise.all([
      this.db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS n ${fromJoin}`),
      this.db.$queryRaw<
        Array<{
          public_id: string;
          order_number: bigint;
          status: string;
          financial_status: string;
          fulfillment_status: string;
          grand_total: string;
          currency: string;
          placed_at: Date;
          items_count: number;
        }>
      >(Prisma.sql`
        SELECT o.public_id, o.order_number, o.status, o.financial_status, o.fulfillment_status,
               o.grand_total::text AS grand_total, o.currency, o.placed_at, li.items_count
        ${fromJoin}
        ORDER BY o.placed_at DESC
        LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}`),
    ]);

    return {
      total: Number(countRows[0]?.n ?? 0n),
      page: filter.page,
      pageSize: filter.pageSize,
      orders: rows.map((r) => ({
        publicId: r.public_id,
        orderNumber: r.order_number.toString(),
        status: r.status,
        financialStatus: r.financial_status,
        fulfillmentStatus: r.fulfillment_status,
        grandTotal: formatDecimal(r.grand_total),
        currency: r.currency,
        placedAt: r.placed_at,
        itemsCount: r.items_count,
      })),
    };
  }
}

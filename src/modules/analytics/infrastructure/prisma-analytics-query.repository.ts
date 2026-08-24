import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  AnalyticsQueryRepository,
  DateRange,
  SalesDailyRow,
  OrderStatusRow,
  ProductPerformanceRow,
  CategoryPerformanceRow,
  PaymentMethodRow,
  ReturnDailyRow,
  FulfillmentDailyRow,
  InventorySnapshotRow,
  RfmSegmentCount,
  ReconciliationRow,
  CustomerActivityRow,
  TopCustomerRow,
  InventoryTrendRow,
} from '../domain/queries.js';

/**
 * MVP simplification (documented, not accidental — plan/19 §14): every
 * multi-row query here SUMS across currency rather than breaking dashboard
 * output out per-currency. Every summary_* table is still keyed correctly
 * by currency (schema-reviewer finding, see analytics.prisma), so nothing
 * is lost — a true multi-currency merchant dashboard is a straightforward
 * later addition (group by currency instead of summing it away) once that's
 * an actual deployment need, not a schema change.
 */
export class PrismaAnalyticsQueryRepository implements AnalyticsQueryRepository {
  constructor(private readonly db: Db) {}

  async getSalesTrend(range: DateRange): Promise<SalesDailyRow[]> {
    const websiteFilter = range.websiteId !== undefined ? Prisma.sql`AND website_id = ${range.websiteId}` : Prisma.empty;
    const rows = await this.db.$queryRaw<
      Array<{
        date_key: number;
        website_id: bigint;
        currency: string;
        gross_revenue: string;
        discount_total: string;
        tax_total: string;
        shipping_total: string;
        refund_total: string;
        net_revenue: string;
        order_count: bigint;
        units_sold: bigint;
        new_customer_count: bigint;
      }>
    >(Prisma.sql`
      SELECT date_key, website_id, currency,
        SUM(gross_revenue) AS gross_revenue, SUM(discount_total) AS discount_total, SUM(tax_total) AS tax_total,
        SUM(shipping_total) AS shipping_total, SUM(refund_total) AS refund_total, SUM(net_revenue) AS net_revenue,
        SUM(order_count) AS order_count, SUM(units_sold) AS units_sold, SUM(new_customer_count) AS new_customer_count
      FROM summary_sales_daily
      WHERE date_key >= ${range.fromDateKey} AND date_key <= ${range.toDateKey}
        ${websiteFilter}
      GROUP BY date_key, website_id, currency
      ORDER BY date_key ASC
    `);
    return rows.map((r) => ({
      dateKey: r.date_key,
      websiteId: r.website_id,
      currency: r.currency,
      grossRevenue: r.gross_revenue,
      discountTotal: r.discount_total,
      taxTotal: r.tax_total,
      shippingTotal: r.shipping_total,
      refundTotal: r.refund_total,
      netRevenue: r.net_revenue,
      orderCount: Number(r.order_count),
      unitsSold: Number(r.units_sold),
      newCustomerCount: Number(r.new_customer_count),
    }));
  }

  async getOrderStatusBreakdown(range: DateRange): Promise<OrderStatusRow[]> {
    const websiteFilter = range.websiteId !== undefined ? { websiteId: range.websiteId } : {};
    const rows = await this.db.summaryOrderStatusDaily.groupBy({
      by: ['dateKey', 'status'],
      where: { dateKey: { gte: range.fromDateKey, lte: range.toDateKey }, ...websiteFilter },
      _sum: { orderCount: true },
      orderBy: { dateKey: 'asc' },
    });
    return rows.map((r) => ({ dateKey: r.dateKey, status: r.status, orderCount: r._sum.orderCount ?? 0 }));
  }

  async getTopProducts(range: DateRange, limit: number): Promise<ProductPerformanceRow[]> {
    const websiteFilter = range.websiteId !== undefined ? Prisma.sql`AND spd.website_id = ${range.websiteId}` : Prisma.empty;
    const rows = await this.db.$queryRaw<
      Array<{ product_id: bigint; product_name: string | null; sku: string | null; units_sold: bigint; revenue: string; order_count: bigint }>
    >(Prisma.sql`
      SELECT spd.product_id, p.name_default AS product_name, p.sku,
        SUM(spd.units_sold) AS units_sold, SUM(spd.revenue) AS revenue, SUM(spd.order_count) AS order_count
      FROM summary_product_daily spd
      LEFT JOIN product p ON p.id = spd.product_id
      WHERE spd.date_key >= ${range.fromDateKey} AND spd.date_key <= ${range.toDateKey}
        ${websiteFilter}
      GROUP BY spd.product_id, p.name_default, p.sku
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      unitsSold: Number(r.units_sold),
      revenue: r.revenue,
      orderCount: Number(r.order_count),
    }));
  }

  async getTopCategories(range: DateRange, limit: number): Promise<CategoryPerformanceRow[]> {
    const websiteFilter = range.websiteId !== undefined ? Prisma.sql`AND scd.website_id = ${range.websiteId}` : Prisma.empty;
    const rows = await this.db.$queryRaw<Array<{ category_id: bigint; category_name: string | null; units_sold: bigint; revenue: string }>>(
      Prisma.sql`
      SELECT scd.category_id, c.name_default AS category_name, SUM(scd.units_sold) AS units_sold, SUM(scd.revenue) AS revenue
      FROM summary_category_daily scd
      LEFT JOIN category c ON c.id = scd.category_id
      WHERE scd.date_key >= ${range.fromDateKey} AND scd.date_key <= ${range.toDateKey}
        ${websiteFilter}
      GROUP BY scd.category_id, c.name_default
      ORDER BY revenue DESC
      LIMIT ${limit}
    `,
    );
    return rows.map((r) => ({ categoryId: r.category_id, categoryName: r.category_name, unitsSold: Number(r.units_sold), revenue: r.revenue }));
  }

  async getPaymentMethodBreakdown(range: DateRange): Promise<PaymentMethodRow[]> {
    const websiteFilter = range.websiteId !== undefined ? Prisma.sql`AND website_id = ${range.websiteId}` : Prisma.empty;
    const rows = await this.db.$queryRaw<
      Array<{ method: string; gateway: string; success_count: bigint; failed_count: bigint; success_amount: string; refunded_amount: string }>
    >(Prisma.sql`
      SELECT method, gateway, SUM(success_count) AS success_count, SUM(failed_count) AS failed_count,
        SUM(success_amount) AS success_amount, SUM(refunded_amount) AS refunded_amount
      FROM summary_payment_method_daily
      WHERE date_key >= ${range.fromDateKey} AND date_key <= ${range.toDateKey}
        ${websiteFilter}
      GROUP BY method, gateway
      ORDER BY success_amount DESC
    `);
    return rows.map((r) => ({
      method: r.method,
      gateway: r.gateway,
      successCount: Number(r.success_count),
      failedCount: Number(r.failed_count),
      successAmount: r.success_amount,
      refundedAmount: r.refunded_amount,
    }));
  }

  async getReturnsTrend(range: DateRange): Promise<ReturnDailyRow[]> {
    const websiteFilter = range.websiteId !== undefined ? Prisma.sql`AND website_id = ${range.websiteId}` : Prisma.empty;
    const rows = await this.db.$queryRaw<Array<{ date_key: number; return_count: bigint; return_qty: bigint; return_amount: string }>>(Prisma.sql`
      SELECT date_key, SUM(return_count) AS return_count, SUM(return_qty) AS return_qty, SUM(return_amount) AS return_amount
      FROM summary_return_daily
      WHERE date_key >= ${range.fromDateKey} AND date_key <= ${range.toDateKey}
        ${websiteFilter}
      GROUP BY date_key
      ORDER BY date_key ASC
    `);
    return rows.map((r) => ({
      dateKey: r.date_key,
      returnCount: Number(r.return_count),
      returnQty: Number(r.return_qty),
      returnAmount: r.return_amount,
    }));
  }

  async getFulfillmentTrend(range: DateRange): Promise<FulfillmentDailyRow[]> {
    const websiteFilter = range.websiteId !== undefined ? { websiteId: range.websiteId } : {};
    const rows = await this.db.summaryFulfillmentDaily.findMany({
      where: { dateKey: { gte: range.fromDateKey, lte: range.toDateKey }, ...websiteFilter },
      orderBy: { dateKey: 'asc' },
    });
    return rows.map((r) => ({
      dateKey: r.dateKey,
      ordersProcessed: r.ordersProcessed,
      avgProcessingHours: r.avgProcessingHours?.toString() ?? null,
      avgShippingHours: r.avgShippingHours?.toString() ?? null,
      avgDeliveryHours: r.avgDeliveryHours?.toString() ?? null,
    }));
  }

  async getLowStockNow(limit: number): Promise<InventorySnapshotRow[]> {
    const rows = await this.db.$queryRaw<
      Array<{
        variant_id: bigint;
        sku: string | null;
        product_name: string | null;
        warehouse_id: bigint;
        warehouse_name: string | null;
        on_hand: number;
        reserved: number;
        available: number;
        reorder_point: number | null;
      }>
    >`
      SELECT si.variant_id, pv.sku, p.name_default AS product_name, si.warehouse_id, w.name AS warehouse_name,
        si.on_hand, si.reserved, si.available, si.reorder_point
      FROM stock_item si
      LEFT JOIN product_variant pv ON pv.id = si.variant_id
      LEFT JOIN product p ON p.id = pv.product_id
      LEFT JOIN warehouse w ON w.id = si.warehouse_id
      WHERE si.reorder_point IS NOT NULL AND si.available <= si.reorder_point
      ORDER BY si.available ASC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      variantId: r.variant_id,
      sku: r.sku,
      productName: r.product_name,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      onHand: r.on_hand,
      reserved: r.reserved,
      available: r.available,
      reorderPoint: r.reorder_point,
    }));
  }

  async countLowStock(): Promise<number> {
    const rows = await this.db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM stock_item WHERE reorder_point IS NOT NULL AND available <= reorder_point
    `);
    return Number(rows[0]?.n ?? 0n);
  }

  async countOutOfStock(): Promise<number> {
    const rows = await this.db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM stock_item WHERE available <= 0
    `);
    return Number(rows[0]?.n ?? 0n);
  }

  async getRfmSegments(): Promise<RfmSegmentCount[]> {
    const rows = await this.db.customerRfm.groupBy({ by: ['segment'], _count: { customerId: true } });
    return rows.map((r) => ({ segment: r.segment, customerCount: r._count.customerId }));
  }

  async countStuckOrders(daysThreshold: number, websiteId?: bigint): Promise<number> {
    const websiteFilter = websiteId !== undefined ? Prisma.sql`AND website_id = ${websiteId}` : Prisma.empty;
    const rows = await this.db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n
      FROM "order"
      WHERE status IN ('PROCESSING', 'CONFIRMED')
        AND placed_at < now() - (${daysThreshold} || ' days')::interval
        ${websiteFilter}
    `);
    return Number(rows[0]?.n ?? 0n);
  }

  async getCustomerActivityTrend(range: DateRange): Promise<CustomerActivityRow[]> {
    const rows = await this.db.$queryRaw<
      Array<{ date_key: number; new_customers: bigint; returning_customers: bigint; total_orders: bigint; total_revenue: string }>
    >(Prisma.sql`
      SELECT date_key,
        COUNT(*) FILTER (WHERE is_first_order_day) AS new_customers,
        COUNT(*) FILTER (WHERE NOT is_first_order_day) AS returning_customers,
        COALESCE(SUM(orders_placed), 0) AS total_orders,
        COALESCE(SUM(revenue), 0) AS total_revenue
      FROM fact_customer_daily
      WHERE date_key >= ${range.fromDateKey} AND date_key <= ${range.toDateKey}
      GROUP BY date_key
      ORDER BY date_key ASC
    `);
    return rows.map((r) => ({
      dateKey: r.date_key,
      newCustomers: Number(r.new_customers),
      returningCustomers: Number(r.returning_customers),
      totalOrders: Number(r.total_orders),
      totalRevenue: r.total_revenue,
    }));
  }

  async getTopCustomers(range: DateRange, limit: number): Promise<TopCustomerRow[]> {
    const rows = await this.db.$queryRaw<
      Array<{ customer_id: bigint; email: string | null; first_name: string | null; last_name: string | null; orders_placed: bigint; revenue: string }>
    >(Prisma.sql`
      SELECT fcd.customer_id, c.email, c.first_name, c.last_name,
        SUM(fcd.orders_placed) AS orders_placed, SUM(fcd.revenue) AS revenue
      FROM fact_customer_daily fcd
      LEFT JOIN customer c ON c.id = fcd.customer_id
      WHERE fcd.date_key >= ${range.fromDateKey} AND fcd.date_key <= ${range.toDateKey}
      GROUP BY fcd.customer_id, c.email, c.first_name, c.last_name
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({
      customerId: r.customer_id,
      email: r.email,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
      ordersPlaced: Number(r.orders_placed),
      revenue: r.revenue,
    }));
  }

  async getInventoryTrend(range: DateRange): Promise<InventoryTrendRow[]> {
    const rows = await this.db.$queryRaw<
      Array<{ date_key: number; total_on_hand: bigint; total_reserved: bigint; total_available: bigint; low_stock_count: bigint }>
    >(Prisma.sql`
      SELECT date_key,
        COALESCE(SUM(on_hand), 0) AS total_on_hand,
        COALESCE(SUM(reserved), 0) AS total_reserved,
        COALESCE(SUM(available), 0) AS total_available,
        COUNT(*) FILTER (WHERE reorder_point IS NOT NULL AND available <= reorder_point) AS low_stock_count
      FROM summary_inventory_daily
      WHERE date_key >= ${range.fromDateKey} AND date_key <= ${range.toDateKey}
      GROUP BY date_key
      ORDER BY date_key ASC
    `);
    return rows.map((r) => ({
      dateKey: r.date_key,
      totalOnHand: Number(r.total_on_hand),
      totalReserved: Number(r.total_reserved),
      totalAvailable: Number(r.total_available),
      lowStockCount: Number(r.low_stock_count),
    }));
  }

  async getReconciliationLog(range: DateRange): Promise<ReconciliationRow[]> {
    const rows = await this.db.reconciliationLog.findMany({
      where: { dateKey: { gte: range.fromDateKey, lte: range.toDateKey } },
      orderBy: [{ dateKey: 'desc' }, { tableName: 'asc' }],
    });
    return rows.map((r) => ({
      dateKey: r.dateKey,
      tableName: r.tableName,
      expectedCount: r.expectedCount,
      actualCount: r.actualCount,
      diffCount: r.diffCount,
      diffAmount: r.diffAmount?.toString() ?? null,
    }));
  }
}

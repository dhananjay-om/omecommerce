import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AnalyticsRepository } from '../domain/repositories.js';
import { dateKeyToRange } from '../domain/date-key.js';

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: Db) {}

  async listActiveWebsiteIds(dateKey: number): Promise<bigint[]> {
    const { start, end } = dateKeyToRange(dateKey);
    const rows = await this.db.$queryRaw<Array<{ website_id: bigint }>>`
      SELECT DISTINCT website_id FROM "order" WHERE placed_at >= ${start} AND placed_at < ${end}
    `;
    return rows.map((r) => r.website_id);
  }

  async refreshOrderSummaries(dateKey: number, websiteId: bigint): Promise<void> {
    const { start, end } = dateKeyToRange(dateKey);

    // Every currency this website's orders used on this day gets its own
    // row (schema-review finding — see analytics.prisma's header comment).
    // Orders with financial_status = FAILED are excluded from revenue/order
    // counting entirely (checkout never actually completed for them) —
    // everything else (including a later-CANCELLED order) counts toward
    // "orders placed today", matching how every other e-commerce sales
    // report treats a placed-then-cancelled order: it happened, it's in the
    // funnel, cancellation rate (summary_order_status_daily) is how that
    // shows up, not by pretending the order never existed.
    const salesRows = await this.db.$queryRaw<
      Array<{
        currency: string;
        gross_revenue: string;
        discount_total: string;
        tax_total: string;
        shipping_total: string;
        order_count: bigint;
        units_sold: bigint;
      }>
    >`
      SELECT
        o.currency,
        COALESCE(SUM(o.grand_total), 0) AS gross_revenue,
        COALESCE(SUM(o.discount_total), 0) AS discount_total,
        COALESCE(SUM(o.tax_total), 0) AS tax_total,
        COALESCE(SUM(o.shipping_total), 0) AS shipping_total,
        COUNT(*) AS order_count,
        COALESCE((SELECT SUM(ol.qty) FROM order_line ol WHERE ol.order_id = ANY(array_agg(o.id))), 0) AS units_sold
      FROM "order" o
      WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end}
        AND o.financial_status != 'FAILED'
      GROUP BY o.currency
    `;

    const refundRows = await this.db.$queryRaw<Array<{ currency: string; refund_total: string }>>`
      SELECT o.currency, COALESCE(SUM(pt.amount), 0) AS refund_total
      FROM payment_transaction pt
      JOIN "order" o ON o.id = pt.order_id
      WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end}
        AND pt.type = 'REFUND' AND pt.status = 'SUCCEEDED'
      GROUP BY o.currency
    `;
    const refundByCurrency = new Map(refundRows.map((r) => [r.currency, r.refund_total]));

    const newCustomerRows = await this.db.$queryRaw<Array<{ currency: string; new_customer_count: bigint }>>`
      SELECT o.currency, COUNT(DISTINCT o.customer_id) AS new_customer_count
      FROM "order" o
      WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end}
        AND o.financial_status != 'FAILED' AND o.customer_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "order" earlier
          WHERE earlier.customer_id = o.customer_id AND earlier.placed_at < o.placed_at AND earlier.financial_status != 'FAILED'
        )
      GROUP BY o.currency
    `;
    const newCustomersByCurrency = new Map(newCustomerRows.map((r) => [r.currency, r.new_customer_count]));

    // Zero every existing row for this bucket first — same reasoning as
    // summary_order_status_daily below, generalized: a bucket can now
    // regress from having orders to having none (e.g. a hard-deleted
    // order — DeleteOrder), not just grow. Upserting only the currencies
    // still present today would leave a stale nonzero row for any
    // currency that dropped to zero. Confirmed by actually hitting this:
    // deleting a day's only order left its summary_sales_daily row
    // showing the deleted order's revenue forever, since the empty
    // `salesRows` result below just skips the loop entirely.
    await this.db.$executeRaw`
      UPDATE summary_sales_daily
      SET gross_revenue = 0, discount_total = 0, tax_total = 0, shipping_total = 0, refund_total = 0,
          net_revenue = 0, order_count = 0, units_sold = 0, new_customer_count = 0, updated_at = now()
      WHERE date_key = ${dateKey} AND website_id = ${websiteId} AND order_count != 0
    `;
    for (const row of salesRows) {
      const refundTotal = refundByCurrency.get(row.currency) ?? '0';
      await this.db.$executeRaw`
        INSERT INTO summary_sales_daily (date_key, website_id, currency, gross_revenue, discount_total, tax_total, shipping_total, refund_total, net_revenue, order_count, units_sold, new_customer_count, updated_at)
        VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.gross_revenue}::numeric, ${row.discount_total}::numeric, ${row.tax_total}::numeric, ${row.shipping_total}::numeric, ${refundTotal}::numeric, (${row.gross_revenue}::numeric - ${refundTotal}::numeric), ${row.order_count}, ${row.units_sold}, ${newCustomersByCurrency.get(row.currency) ?? 0n}, now())
        ON CONFLICT (date_key, website_id, currency) DO UPDATE SET
          gross_revenue = EXCLUDED.gross_revenue, discount_total = EXCLUDED.discount_total, tax_total = EXCLUDED.tax_total,
          shipping_total = EXCLUDED.shipping_total, refund_total = EXCLUDED.refund_total, net_revenue = EXCLUDED.net_revenue,
          order_count = EXCLUDED.order_count, units_sold = EXCLUDED.units_sold, new_customer_count = EXCLUDED.new_customer_count,
          updated_at = now()
      `;
    }

    // Order-status funnel — every order counts here regardless of financial_status,
    // unlike the sales rows above (a FAILED-payment order still needs to show up
    // as e.g. CANCELLED in the status breakdown). Unlike every other
    // sub-aggregate in this method, `status` is a CURRENT classification that
    // moves between distinct key values over an order's life (PROCESSING ->
    // CANCELLED, not append-only history) — a re-aggregation that only
    // upserts the statuses present RIGHT NOW would leave a stale nonzero
    // count sitting under whatever status the order used to have. Zero every
    // existing row for this bucket first, then upsert the fresh counts, so a
    // status with no orders left today reads 0, not a leftover value.
    await this.db.$executeRaw`
      UPDATE summary_order_status_daily SET order_count = 0, updated_at = now()
      WHERE date_key = ${dateKey} AND website_id = ${websiteId} AND order_count != 0
    `;
    const statusRows = await this.db.$queryRaw<Array<{ status: string; order_count: bigint }>>`
      SELECT status, COUNT(*) AS order_count FROM "order"
      WHERE website_id = ${websiteId} AND placed_at >= ${start} AND placed_at < ${end}
      GROUP BY status
    `;
    for (const row of statusRows) {
      await this.db.$executeRaw`
        INSERT INTO summary_order_status_daily (date_key, website_id, status, order_count, updated_at)
        VALUES (${dateKey}, ${websiteId}, ${row.status}, ${row.order_count}, now())
        ON CONFLICT (date_key, website_id, status) DO UPDATE SET order_count = EXCLUDED.order_count, updated_at = now()
      `;
    }

    // Product-level — same financial_status != FAILED exclusion as sales,
    // and the same "zero this bucket first" reasoning as sales above.
    await this.db.$executeRaw`
      UPDATE summary_product_daily SET units_sold = 0, revenue = 0, order_count = 0, updated_at = now()
      WHERE date_key = ${dateKey} AND website_id = ${websiteId} AND order_count != 0
    `;
    const productRows = await this.db.$queryRaw<
      Array<{ currency: string; product_id: bigint; units_sold: bigint; revenue: string; order_count: bigint }>
    >`
      SELECT o.currency, pv.product_id, SUM(ol.qty) AS units_sold, SUM(ol.row_total) AS revenue, COUNT(DISTINCT o.id) AS order_count
      FROM order_line ol
      JOIN "order" o ON o.id = ol.order_id
      JOIN product_variant pv ON pv.id = ol.variant_id
      WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end} AND o.financial_status != 'FAILED'
      GROUP BY o.currency, pv.product_id
    `;
    for (const row of productRows) {
      await this.db.$executeRaw`
        INSERT INTO summary_product_daily (date_key, website_id, currency, product_id, units_sold, revenue, order_count, updated_at)
        VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.product_id}, ${row.units_sold}, ${row.revenue}::numeric, ${row.order_count}, now())
        ON CONFLICT (date_key, website_id, currency, product_id) DO UPDATE SET
          units_sold = EXCLUDED.units_sold, revenue = EXCLUDED.revenue, order_count = EXCLUDED.order_count, updated_at = now()
      `;
    }

    // Category-level — a line's product can sit in multiple categories;
    // every one gets credited (matches this table's own doc comment). Same
    // "zero this bucket first" reasoning as sales/product above.
    await this.db.$executeRaw`
      UPDATE summary_category_daily SET units_sold = 0, revenue = 0, updated_at = now()
      WHERE date_key = ${dateKey} AND website_id = ${websiteId} AND units_sold != 0
    `;
    const categoryRows = await this.db.$queryRaw<Array<{ currency: string; category_id: bigint; units_sold: bigint; revenue: string }>>`
      SELECT o.currency, pc.category_id, SUM(ol.qty) AS units_sold, SUM(ol.row_total) AS revenue
      FROM order_line ol
      JOIN "order" o ON o.id = ol.order_id
      JOIN product_variant pv ON pv.id = ol.variant_id
      JOIN product_category pc ON pc.product_id = pv.product_id
      WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end} AND o.financial_status != 'FAILED'
      GROUP BY o.currency, pc.category_id
    `;
    for (const row of categoryRows) {
      await this.db.$executeRaw`
        INSERT INTO summary_category_daily (date_key, website_id, currency, category_id, units_sold, revenue, updated_at)
        VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.category_id}, ${row.units_sold}, ${row.revenue}::numeric, now())
        ON CONFLICT (date_key, website_id, currency, category_id) DO UPDATE SET
          units_sold = EXCLUDED.units_sold, revenue = EXCLUDED.revenue, updated_at = now()
      `;
    }

    // Payment method success/failure — keyed by the transaction's OWN
    // currency (PaymentTransaction.currency, not the order's, though this
    // codebase enforces they match via a raw-SQL trigger — see
    // payment_transaction's own schema comment).
    const paymentRows = await this.db.$queryRaw<
      Array<{ currency: string; method: string; gateway: string; success_count: bigint; failed_count: bigint; success_amount: string; refunded_amount: string }>
    >`
      SELECT
        pt.currency, pt.method, pt.gateway,
        COUNT(*) FILTER (WHERE pt.type = 'CAPTURE' AND pt.status = 'SUCCEEDED') AS success_count,
        COUNT(*) FILTER (WHERE pt.status = 'FAILED') AS failed_count,
        COALESCE(SUM(pt.amount) FILTER (WHERE pt.type = 'CAPTURE' AND pt.status = 'SUCCEEDED'), 0) AS success_amount,
        COALESCE(SUM(pt.amount) FILTER (WHERE pt.type = 'REFUND' AND pt.status = 'SUCCEEDED'), 0) AS refunded_amount
      FROM payment_transaction pt
      JOIN "order" o ON o.id = pt.order_id
      WHERE o.website_id = ${websiteId} AND pt.created_at >= ${start} AND pt.created_at < ${end}
      GROUP BY pt.currency, pt.method, pt.gateway
    `;
    for (const row of paymentRows) {
      await this.db.$executeRaw`
        INSERT INTO summary_payment_method_daily (date_key, website_id, currency, method, gateway, success_count, failed_count, success_amount, refunded_amount, updated_at)
        VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.method}, ${row.gateway}, ${row.success_count}, ${row.failed_count}, ${row.success_amount}::numeric, ${row.refunded_amount}::numeric, now())
        ON CONFLICT (date_key, website_id, currency, method, gateway) DO UPDATE SET
          success_count = EXCLUDED.success_count, failed_count = EXCLUDED.failed_count,
          success_amount = EXCLUDED.success_amount, refunded_amount = EXCLUDED.refunded_amount, updated_at = now()
      `;
    }

    // Returns — bucketed by the OrderReturn's own createdAt (when the RMA
    // was filed), not the original order's placed_at.
    const returnRows = await this.db.$queryRaw<Array<{ currency: string; return_count: bigint; return_qty: bigint; return_amount: string }>>`
      SELECT o.currency, COUNT(DISTINCT orr.id) AS return_count, COALESCE(SUM(orl.qty), 0) AS return_qty,
             COALESCE(SUM(orl.qty * ol.unit_price), 0) AS return_amount
      FROM order_return orr
      JOIN "order" o ON o.id = orr.order_id
      JOIN order_return_line orl ON orl.return_id = orr.id
      JOIN order_line ol ON ol.id = orl.order_line_id
      WHERE o.website_id = ${websiteId} AND orr.created_at >= ${start} AND orr.created_at < ${end}
      GROUP BY o.currency
    `;
    for (const row of returnRows) {
      await this.db.$executeRaw`
        INSERT INTO summary_return_daily (date_key, website_id, currency, return_count, return_qty, return_amount, updated_at)
        VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.return_count}, ${row.return_qty}, ${row.return_amount}::numeric, now())
        ON CONFLICT (date_key, website_id, currency) DO UPDATE SET
          return_count = EXCLUDED.return_count, return_qty = EXCLUDED.return_qty, return_amount = EXCLUDED.return_amount, updated_at = now()
      `;
    }

    // Per-customer daily activity + first-order marking (feeds the Customer
    // dashboard's new-vs-returning trend). isFirstOrderDay compares against
    // the customer's OWN order history, computed once here — never
    // reinterpreted later, same snapshot discipline as OrderLine's price/name.
    const customerRows = await this.db.$queryRaw<Array<{ customer_id: bigint; orders_placed: bigint; revenue: string }>>`
      SELECT customer_id, COUNT(*) AS orders_placed, SUM(grand_total) AS revenue
      FROM "order"
      WHERE website_id = ${websiteId} AND placed_at >= ${start} AND placed_at < ${end}
        AND financial_status != 'FAILED' AND customer_id IS NOT NULL
      GROUP BY customer_id
    `;
    for (const row of customerRows) {
      const isFirst = await this.db.$queryRaw<Array<{ is_first: boolean }>>`
        SELECT NOT EXISTS (
          SELECT 1 FROM "order" WHERE customer_id = ${row.customer_id} AND placed_at < ${start} AND financial_status != 'FAILED'
        ) AS is_first
      `;
      await this.db.$executeRaw`
        INSERT INTO fact_customer_daily (date_key, customer_id, orders_placed, revenue, is_first_order_day, updated_at)
        VALUES (${dateKey}, ${row.customer_id}, ${row.orders_placed}, ${row.revenue}::numeric, ${isFirst[0]?.is_first ?? false}, now())
        ON CONFLICT (date_key, customer_id) DO UPDATE SET
          orders_placed = EXCLUDED.orders_placed, revenue = EXCLUDED.revenue, is_first_order_day = EXCLUDED.is_first_order_day, updated_at = now()
      `;
    }
  }

  async refreshFulfillmentSummary(dateKey: number, websiteId: bigint): Promise<void> {
    const { start, end } = dateKeyToRange(dateKey);
    // avg_delivery_hours is intentionally never set — Fulfillment has no
    // delivered-at timestamp anywhere in this schema (only a ShipmentStatus
    // enum reaching DELIVERED, no column recording WHEN) — see this table's
    // own doc comment in analytics.prisma.
    const rows = await this.db.$queryRaw<Array<{ orders_processed: bigint; avg_processing_hours: string | null; avg_shipping_hours: string | null }>>`
      SELECT
        COUNT(DISTINCT f.order_id) AS orders_processed,
        AVG(EXTRACT(EPOCH FROM (f.created_at - o.placed_at)) / 3600.0) AS avg_processing_hours,
        AVG(EXTRACT(EPOCH FROM (f.shipped_at - f.created_at)) / 3600.0) FILTER (WHERE f.shipped_at IS NOT NULL) AS avg_shipping_hours
      FROM fulfillment f
      JOIN "order" o ON o.id = f.order_id
      WHERE o.website_id = ${websiteId} AND f.created_at >= ${start} AND f.created_at < ${end}
    `;
    const row = rows[0];
    if (!row || row.orders_processed === 0n) return;
    await this.db.$executeRaw`
      INSERT INTO summary_fulfillment_daily (date_key, website_id, orders_processed, avg_processing_hours, avg_shipping_hours, avg_delivery_hours, updated_at)
      VALUES (${dateKey}, ${websiteId}, ${row.orders_processed}, ${row.avg_processing_hours}::numeric, ${row.avg_shipping_hours}::numeric, NULL, now())
      ON CONFLICT (date_key, website_id) DO UPDATE SET
        orders_processed = EXCLUDED.orders_processed, avg_processing_hours = EXCLUDED.avg_processing_hours,
        avg_shipping_hours = EXCLUDED.avg_shipping_hours, updated_at = now()
    `;
  }

  async snapshotInventory(dateKey: number): Promise<void> {
    // stock_item.available is a Postgres GENERATED column (see
    // inventory.prisma's own doc comment) — read via raw SQL like every
    // other consumer of it in this codebase.
    await this.db.$executeRaw`
      INSERT INTO summary_inventory_daily (date_key, variant_id, warehouse_id, on_hand, reserved, available, reorder_point, created_at)
      SELECT ${dateKey}, variant_id, warehouse_id, on_hand, reserved, available, reorder_point, now()
      FROM stock_item
      ON CONFLICT (date_key, variant_id, warehouse_id) DO UPDATE SET
        on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, available = EXCLUDED.available, reorder_point = EXCLUDED.reorder_point
    `;
  }

  async refreshCustomerRfm(): Promise<void> {
    // Quintile scoring (1-5) against the current customer population.
    // Recency: fewer days since last order = higher score (5). Frequency/
    // Monetary: higher = higher score. NTILE(5) needs at least 5 customers
    // with order history to produce real quintiles; with fewer, every score
    // still computes (Postgres NTILE degrades gracefully to fewer buckets),
    // just less meaningfully — acceptable for a store's early days.
    await this.db.$executeRaw`
      WITH customer_orders AS (
        SELECT
          customer_id,
          COUNT(*) AS frequency,
          SUM(grand_total) AS monetary,
          EXTRACT(EPOCH FROM (now() - MAX(placed_at))) / 86400.0 AS recency_days
        FROM "order"
        WHERE customer_id IS NOT NULL AND financial_status != 'FAILED'
        GROUP BY customer_id
      ),
      scored AS (
        SELECT
          customer_id, frequency, monetary, recency_days,
          NTILE(5) OVER (ORDER BY recency_days DESC) AS recency_score,
          NTILE(5) OVER (ORDER BY frequency ASC) AS frequency_score,
          NTILE(5) OVER (ORDER BY monetary ASC) AS monetary_score
        FROM customer_orders
      )
      INSERT INTO customer_rfm (customer_id, recency_days, frequency, monetary, recency_score, frequency_score, monetary_score, segment, computed_at)
      SELECT
        customer_id, recency_days::int, frequency, monetary, recency_score, frequency_score, monetary_score,
        CASE
          WHEN recency_score >= 4 AND frequency_score >= 4 AND monetary_score >= 4 THEN 'CHAMPION'
          WHEN frequency_score >= 4 AND monetary_score >= 3 THEN 'LOYAL'
          WHEN recency_score <= 2 AND frequency_score >= 3 THEN 'AT_RISK'
          WHEN recency_score <= 2 AND frequency_score <= 2 THEN 'LOST'
          WHEN frequency_score <= 2 AND recency_score >= 4 THEN 'NEW'
          ELSE 'REGULAR'
        END AS segment,
        now()
      FROM scored
      ON CONFLICT (customer_id) DO UPDATE SET
        recency_days = EXCLUDED.recency_days, frequency = EXCLUDED.frequency, monetary = EXCLUDED.monetary,
        recency_score = EXCLUDED.recency_score, frequency_score = EXCLUDED.frequency_score, monetary_score = EXCLUDED.monetary_score,
        segment = EXCLUDED.segment, computed_at = now()
    `;
    // A customer whose only orders are now all FAILED (or who otherwise
    // dropped out of customer_orders above) must not keep a stale row.
    await this.db.$executeRaw`
      DELETE FROM customer_rfm
      WHERE customer_id NOT IN (
        SELECT DISTINCT customer_id FROM "order" WHERE customer_id IS NOT NULL AND financial_status != 'FAILED'
      )
    `;
  }

  async reconcileDay(dateKey: number): Promise<void> {
    const { start, end } = dateKeyToRange(dateKey);
    const oltpRows = await this.db.$queryRaw<Array<{ website_id: bigint; currency: string; order_count: bigint; gross_revenue: string }>>`
      SELECT website_id, currency, COUNT(*) AS order_count, COALESCE(SUM(grand_total), 0) AS gross_revenue
      FROM "order" WHERE placed_at >= ${start} AND placed_at < ${end} AND financial_status != 'FAILED'
      GROUP BY website_id, currency
    `;
    const summaryRows = await this.db.$queryRaw<Array<{ website_id: bigint; currency: string; order_count: number; gross_revenue: string }>>`
      SELECT website_id, currency, order_count, gross_revenue FROM summary_sales_daily WHERE date_key = ${dateKey}
    `;
    const summaryByKey = new Map(summaryRows.map((r) => [`${r.website_id}:${r.currency}`, r]));
    const seen = new Set<string>();

    for (const oltp of oltpRows) {
      const key = `${oltp.website_id}:${oltp.currency}`;
      seen.add(key);
      const summary = summaryByKey.get(key);
      const actualCount = summary?.order_count ?? 0;
      const actualAmount = summary ? Number(summary.gross_revenue) : 0;
      const expectedCount = Number(oltp.order_count);
      const expectedAmount = Number(oltp.gross_revenue);
      await this.db.$executeRaw`
        INSERT INTO reconciliation_log (date_key, table_name, expected_count, actual_count, expected_amount, actual_amount, diff_count, diff_amount, created_at)
        VALUES (${dateKey}, ${'summary_sales_daily:' + key}, ${expectedCount}, ${actualCount}, ${expectedAmount}::numeric, ${actualAmount}::numeric, ${expectedCount - actualCount}, ${(expectedAmount - actualAmount).toString()}::numeric, now())
      `;
    }
    // A summary bucket with no matching OLTP orders at all (shouldn't happen
    // if refreshOrderSummaries only ever creates rows FROM real orders, but
    // logged explicitly rather than assumed impossible).
    for (const [key, summary] of summaryByKey) {
      if (seen.has(key)) continue;
      await this.db.$executeRaw`
        INSERT INTO reconciliation_log (date_key, table_name, expected_count, actual_count, expected_amount, actual_amount, diff_count, diff_amount, created_at)
        VALUES (${dateKey}, ${'summary_sales_daily:' + key + ':orphan'}, 0, ${summary.order_count}, 0::numeric, ${summary.gross_revenue}::numeric, ${-summary.order_count}, ${'-' + summary.gross_revenue}::numeric, now())
      `;
    }
  }
}

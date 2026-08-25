#!/usr/bin/env node
// Seeds realistic demo ORDERS spread across dates and products, so the
// Dashboard/Reports analytics (revenue trend, top products/categories,
// order-status mix) show real variety instead of a single spike on
// whatever day someone last clicked around the storefront.
//
// Run scripts/seed-demo-data.mjs FIRST if the catalog is empty — this
// script needs existing active, in-stock products to sell.
//
// Every order goes through the REAL checkout flow (cart -> add lines ->
// checkout), exactly like a real customer — correct stock deduction,
// payment records, line-item price snapshots, no shortcuts. The one thing
// checkout can't do is backdate itself (by design — a merchant shouldn't
// be able to backdate a real order from the UI, and neither should this
// script pretend to be a real customer from the past). So after each
// order is placed, this does a direct database write to move its
// placed_at (+ its payment/fulfillment timestamps) to a random day in the
// past — the same "no admin endpoint for this" pattern seed-demo-data.mjs
// already uses for its store-warehouse mapping.
//
// That backdating alone isn't enough, though: analytics are pre-aggregated
// into summary_sales_daily/summary_order_status_daily/summary_product_daily/
// summary_category_daily by an event-driven projector that already wrote
// each order into TODAY's bucket the moment checkout completed (before the
// backdate). Left alone, that's stale until the 02:15 UTC nightly refresh
// job runs. So this also re-runs the exact same aggregation SQL those
// workers use (prisma-analytics.repository.ts's refreshOrderSummaries) for
// every (dateKey, websiteId) bucket touched — both the original "today"
// bucket (to remove the now-wrong entry) and the new backdated one (to add
// it) — so the Dashboard reflects the spread immediately, not tomorrow.
//
// IMPORTANT: this creates REAL orders (real stock deduction, real payment
// records) and directly rewrites timestamps in the database it's pointed
// at. Safe to run against local dev; think before running it against a
// production database with real customer activity you don't want mixed
// with synthetic demo orders.
//
// Usage:
//   node scripts/seed-demo-orders.mjs
// Env overrides:
//   API_BASE_URL                  default http://localhost:4100
//   ADMIN_EMAIL / ADMIN_PASSWORD  default the dev seed admin (see prisma/seed.ts)
//   ORDER_COUNT                   default 60
//   DAYS_BACK                     default 90 (orders spread across the last N days)
//   STORE_VIEW_ID                 default '1' (same default apps/storefront/src/lib/config.ts uses)
import { PrismaClient } from '@prisma/client';

const API = process.env.API_BASE_URL ?? 'http://localhost:4100';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@ome.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'dev-only-password-change-me';
const ORDER_COUNT = Number(process.env.ORDER_COUNT ?? 60);
const DAYS_BACK = Number(process.env.DAYS_BACK ?? 90);
const STORE_VIEW_ID = process.env.STORE_VIEW_ID ?? '1';

async function call(method, apiPath, body, token) {
  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${apiPath} -> ${res.status}: ${text}`);
  return json?.data;
}

const login = await call('POST', '/admin/v1/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
const token = login.token;
const A = (method, apiPath, body) => call(method, apiPath, body, token);
const S = (method, apiPath, body) => call(method, apiPath, body); // storefront cart/checkout — unauthenticated

console.log(`logged in as ${ADMIN_EMAIL}; creating up to ${ORDER_COUNT} orders spread across the last ${DAYS_BACK} days`);

// A storeViewId's currency isn't documented anywhere — the only way to
// learn it is to actually create a cart for it and read back what currency
// it resolved to (a website can be configured for INR, USD, or anything
// else). Everything downstream (which variants are sellable, which
// shipping method to use) is scoped to that one currency.
const probeCart = await S('POST', '/store/v1/carts', { storeViewId: STORE_VIEW_ID });
const currency = probeCart.currency;
console.log(`storeViewId ${STORE_VIEW_ID} resolves to currency ${currency}`);

const shippingMethods = await S('GET', `/store/v1/shipping-methods?currency=${currency}`);
const shippingMethodCode = shippingMethods[0]?.code;
if (!shippingMethodCode) {
  console.error(`No shipping method configured for currency ${currency} — set one up under Stores > Shipping Methods first.`);
  process.exit(1);
}
console.log(`using shipping method ${shippingMethodCode}`);

// --- Discover sellable products, and pre-filter to variants that actually
// have a price in this currency — checkout only validates pricing at the
// very end, so without this a lot of orders would fail late and waste the
// cart/lines work already done. ---------------------------------------------
const productList = await A('GET', '/admin/v1/products?status=ACTIVE&pageSize=100');
const activeProducts = productList.products.filter((p) => p.salableQuantity > 0);
if (activeProducts.length === 0) {
  console.error('No active, in-stock products found — run scripts/seed-demo-data.mjs first.');
  process.exit(1);
}

// `remaining` is a local, best-effort mirror of salableQuantity, decremented
// optimistically on every line added — not authoritative (checkout/stock
// reservation is the real source of truth, and other traffic could change
// it concurrently), just enough to stop this script from repeatedly trying
// a variant it already knows is thin on stock.
const sellable = []; // { product, variantId, remaining }
for (const product of activeProducts) {
  const detail = await A('GET', `/admin/v1/products/${product.publicId}`);
  const variant = detail.variants[0];
  if (!variant) continue;
  const prices = await A('GET', `/admin/v1/variants/${variant.publicId}/prices`);
  const hasPrice = prices.some((p) => p.currency === currency && p.price !== null);
  if (hasPrice) sellable.push({ product, variantId: variant.publicId, remaining: product.salableQuantity });
}
if (sellable.length === 0) {
  console.error(`No sellable variants with a ${currency} price found — set prices under Products > Pricing first.`);
  process.exit(1);
}
console.log(`found ${sellable.length}/${activeProducts.length} sellable products priced in ${currency}`);
if (sellable.length < 5) {
  console.log(`(only ${sellable.length} — for more variety across orders, price more products in ${currency} under Products > Pricing)`);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Date-key helpers — mirrors src/modules/analytics/domain/date-key.ts exactly,
// the shared bucketing convention every analytics query keys by (UTC calendar day). ---
function dateKeyOf(date) {
  return Number(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`);
}
function dateKeyToRange(dateKey) {
  const s = String(dateKey);
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6)) - 1;
  const day = Number(s.slice(6, 8));
  return { start: new Date(Date.UTC(year, month, day)), end: new Date(Date.UTC(year, month, day + 1)) };
}
function randomPastDate(daysBack) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - randInt(0, daysBack - 1));
  d.setUTCHours(randInt(8, 21), randInt(0, 59), randInt(0, 59), 0); // plausible shopping hours
  return d;
}

const prisma = new PrismaClient();

/** Re-runs prisma-analytics.repository.ts's refreshOrderSummaries for one
 *  (dateKey, websiteId) bucket — sales/order-status/product/category only.
 *  Not reproduced here: payment-method/return/fulfillment/customer-activity
 *  summary tables, since neither the Dashboard nor this session's Reports
 *  pages read them — the nightly refresh job will still catch those up on
 *  its normal schedule; this just doesn't wait for it on the 4 tables that
 *  matter for what's visible today. */
async function refreshDay(dateKey, websiteId) {
  const { start, end } = dateKeyToRange(dateKey);

  const salesRows = await prisma.$queryRaw`
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
  const refundRows = await prisma.$queryRaw`
    SELECT o.currency, COALESCE(SUM(pt.amount), 0) AS refund_total
    FROM payment_transaction pt JOIN "order" o ON o.id = pt.order_id
    WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end}
      AND pt.type = 'REFUND' AND pt.status = 'SUCCEEDED'
    GROUP BY o.currency
  `;
  const refundByCurrency = new Map(refundRows.map((r) => [r.currency, r.refund_total]));
  const newCustomerRows = await prisma.$queryRaw`
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

  for (const row of salesRows) {
    const refundTotal = refundByCurrency.get(row.currency) ?? '0';
    await prisma.$executeRaw`
      INSERT INTO summary_sales_daily (date_key, website_id, currency, gross_revenue, discount_total, tax_total, shipping_total, refund_total, net_revenue, order_count, units_sold, new_customer_count, updated_at)
      VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.gross_revenue}::numeric, ${row.discount_total}::numeric, ${row.tax_total}::numeric, ${row.shipping_total}::numeric, ${refundTotal}::numeric, (${row.gross_revenue}::numeric - ${refundTotal}::numeric), ${row.order_count}, ${row.units_sold}, ${newCustomersByCurrency.get(row.currency) ?? 0n}, now())
      ON CONFLICT (date_key, website_id, currency) DO UPDATE SET
        gross_revenue = EXCLUDED.gross_revenue, discount_total = EXCLUDED.discount_total, tax_total = EXCLUDED.tax_total,
        shipping_total = EXCLUDED.shipping_total, refund_total = EXCLUDED.refund_total, net_revenue = EXCLUDED.net_revenue,
        order_count = EXCLUDED.order_count, units_sold = EXCLUDED.units_sold, new_customer_count = EXCLUDED.new_customer_count,
        updated_at = now()
    `;
  }

  await prisma.$executeRaw`
    UPDATE summary_order_status_daily SET order_count = 0, updated_at = now()
    WHERE date_key = ${dateKey} AND website_id = ${websiteId} AND order_count != 0
  `;
  const statusRows = await prisma.$queryRaw`
    SELECT status, COUNT(*) AS order_count FROM "order"
    WHERE website_id = ${websiteId} AND placed_at >= ${start} AND placed_at < ${end}
    GROUP BY status
  `;
  for (const row of statusRows) {
    await prisma.$executeRaw`
      INSERT INTO summary_order_status_daily (date_key, website_id, status, order_count, updated_at)
      VALUES (${dateKey}, ${websiteId}, ${row.status}, ${row.order_count}, now())
      ON CONFLICT (date_key, website_id, status) DO UPDATE SET order_count = EXCLUDED.order_count, updated_at = now()
    `;
  }

  const productRows = await prisma.$queryRaw`
    SELECT o.currency, pv.product_id, SUM(ol.qty) AS units_sold, SUM(ol.row_total) AS revenue, COUNT(DISTINCT o.id) AS order_count
    FROM order_line ol
    JOIN "order" o ON o.id = ol.order_id
    JOIN product_variant pv ON pv.id = ol.variant_id
    WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end} AND o.financial_status != 'FAILED'
    GROUP BY o.currency, pv.product_id
  `;
  for (const row of productRows) {
    await prisma.$executeRaw`
      INSERT INTO summary_product_daily (date_key, website_id, currency, product_id, units_sold, revenue, order_count, updated_at)
      VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.product_id}, ${row.units_sold}, ${row.revenue}::numeric, ${row.order_count}, now())
      ON CONFLICT (date_key, website_id, currency, product_id) DO UPDATE SET
        units_sold = EXCLUDED.units_sold, revenue = EXCLUDED.revenue, order_count = EXCLUDED.order_count, updated_at = now()
    `;
  }

  const categoryRows = await prisma.$queryRaw`
    SELECT o.currency, pc.category_id, SUM(ol.qty) AS units_sold, SUM(ol.row_total) AS revenue
    FROM order_line ol
    JOIN "order" o ON o.id = ol.order_id
    JOIN product_variant pv ON pv.id = ol.variant_id
    JOIN product_category pc ON pc.product_id = pv.product_id
    WHERE o.website_id = ${websiteId} AND o.placed_at >= ${start} AND o.placed_at < ${end} AND o.financial_status != 'FAILED'
    GROUP BY o.currency, pc.category_id
  `;
  for (const row of categoryRows) {
    await prisma.$executeRaw`
      INSERT INTO summary_category_daily (date_key, website_id, currency, category_id, units_sold, revenue, updated_at)
      VALUES (${dateKey}, ${websiteId}, ${row.currency}, ${row.category_id}, ${row.units_sold}, ${row.revenue}::numeric, now())
      ON CONFLICT (date_key, website_id, currency, category_id) DO UPDATE SET
        units_sold = EXCLUDED.units_sold, revenue = EXCLUDED.revenue, updated_at = now()
    `;
  }
}

// --- Main loop ----------------------------------------------------------------
const touchedBuckets = new Map(); // `${dateKey}:${websiteId}` -> { dateKey, websiteId }
let created = 0;
let skipped = 0;

for (let i = 0; i < ORDER_COUNT; i++) {
  try {
    const cart = await S('POST', '/store/v1/carts', { storeViewId: STORE_VIEW_ID });
    const cartId = cart.publicId;

    let addedAny = false;
    const lineCount = randInt(1, 3);
    for (let j = 0; j < lineCount; j++) {
      const inStock = sellable.filter((s) => s.remaining > 0);
      if (inStock.length === 0) break;
      const item = pick(inStock);
      const qty = Math.min(randInt(1, 2), item.remaining);
      try {
        await S('POST', `/store/v1/carts/${cartId}/lines`, { variantId: item.variantId, qty });
        item.remaining -= qty;
        addedAny = true;
      } catch {
        // Out of stock by now (depleted by an earlier iteration) — try a different line.
        item.remaining = 0;
      }
    }
    if (!addedAny) {
      skipped++;
      continue;
    }

    const n = i + 1;
    const address = { name: `Demo Customer ${n}`, line1: `${randInt(1, 999)} Market St`, city: 'Springfield', postalCode: '12345', country: 'US' };
    const order = await S('POST', `/store/v1/carts/${cartId}/checkout`, {
      email: `demo-order-${n}@example.com`,
      billingAddress: address,
      shippingAddress: address,
      shippingMethodCode,
      paymentMethod: 'test_card',
    });

    // Diversify status/fulfillment so Real-Time Operations/Order Status
    // tiles show real variety instead of every order sitting in the same
    // state: ~12% cancelled, ~33% fully fulfilled (half of those also
    // closed), the rest left as placed/paid ("ready to fulfill").
    const roll = Math.random();
    if (roll < 0.12) {
      await A('POST', `/admin/v1/orders/${order.publicId}/cancel`, { reason: 'Demo seed variety', refundTo: 'ORIGINAL_PAYMENT_METHOD' }).catch(() => {});
    } else if (roll < 0.45) {
      const detail = await A('GET', `/admin/v1/orders/${order.publicId}`);
      const lines = detail.lines.map((l) => ({ sku: l.sku, qty: l.qty }));
      await A('POST', `/admin/v1/orders/${order.publicId}/fulfillments`, { lines, carrier: 'Demo Carrier', trackingNumber: `DEMO${randInt(100000, 999999)}` }).catch(() => {});
      if (roll < 0.3) await A('POST', `/admin/v1/orders/${order.publicId}/close`).catch(() => {});
    }

    // Backdate — direct write, no admin endpoint for this by design (a
    // merchant shouldn't be able to backdate a real order from the UI).
    const targetDate = randomPastDate(DAYS_BACK);
    const originalDateKey = dateKeyOf(new Date());
    const targetDateKey = dateKeyOf(targetDate);

    const [{ id: orderId, website_id: websiteId }] = await prisma.$queryRaw`
      SELECT id, website_id FROM "order" WHERE public_id = ${order.publicId}::uuid
    `;
    await prisma.$executeRaw`UPDATE "order" SET placed_at = ${targetDate} WHERE id = ${orderId}`;
    await prisma.$executeRaw`UPDATE payment_transaction SET created_at = ${targetDate} WHERE order_id = ${orderId}`;
    await prisma.$executeRaw`
      UPDATE fulfillment SET created_at = ${targetDate}, shipped_at = CASE WHEN shipped_at IS NOT NULL THEN ${targetDate} ELSE NULL END
      WHERE order_id = ${orderId}
    `;

    for (const dk of [originalDateKey, targetDateKey]) {
      const key = `${dk}:${websiteId}`;
      if (!touchedBuckets.has(key)) touchedBuckets.set(key, { dateKey: dk, websiteId });
    }

    created++;
    if (created % 10 === 0) console.log(`${created}/${ORDER_COUNT} orders created...`);
  } catch (err) {
    skipped++;
    console.error(`order ${i + 1} failed: ${err.message}`);
  }
}

console.log(`created ${created} orders (${skipped} skipped). Refreshing analytics for ${touchedBuckets.size} day/website buckets...`);
for (const { dateKey, websiteId } of touchedBuckets.values()) {
  await refreshDay(dateKey, websiteId);
}
// RFM segments are a full snapshot recompute (not bucketed by day), worth
// refreshing once now rather than waiting for the nightly job, since
// "By Customer Segment" on the Dashboard reads customer_rfm directly.
// Mirrors prisma-analytics.repository.ts's refreshCustomerRfm() exactly.
try {
  await prisma.$executeRaw`
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
  await prisma.$executeRaw`
    DELETE FROM customer_rfm
    WHERE customer_id NOT IN (
      SELECT DISTINCT customer_id FROM "order" WHERE customer_id IS NOT NULL AND financial_status != 'FAILED'
    )
  `;
} catch (err) {
  console.error('RFM refresh skipped (non-fatal):', err.message);
}

await prisma.$disconnect();
console.log('done. Reload /admin/dashboard to see the spread.');

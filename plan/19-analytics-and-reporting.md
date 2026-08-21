# Phase 19 — Analytics & Reporting

> **Positioning:** This is not a new bounded context invented from scratch —
> `00-master-plan.md` §3 already names **Analytics** as a bounded context
> ("Read-model aggregates, dashboards | consumes all events") and §4.6
> literally lists `analytics_events` among the tables planned for
> time-partitioning. This phase is that long-anticipated context, finally
> built, wired to the outbox/BullMQ pipeline every other async feature in
> this codebase already uses (search indexing, loyalty earn, referral
> qualify, order-confirmation email).

**Author role:** Senior Solution Architect / Data Architect / Backend
Architect / Frontend Architect / Analytics Engineer (per request).
**Reuses:** Prisma + PostgreSQL, Redis + BullMQ (outbox relay pattern),
existing RBAC (`Role`/`Permission`/`RolePermission`), existing CSV/Excel
export pattern (`export-orders.usecase.ts`), existing admin app (Next.js)
and its nav/permission conventions.
**Adds:** zero new infrastructure services. No Kafka, no Azure Service Bus,
no separate data warehouse, no new auth system.

---

## 0. Scope note — what was cut from the original brief, and why

The brief this plan is adapted from is written for a company **downstream**
of Shopify/Magento/Salesforce/ERP/CRM — an analytics product that
*ingests* another platform's data over webhooks and REST/GraphQL APIs.
**OMEcommerce is not downstream of anything — it *is* the source system.**
Every order, product, customer, and payment row this plan needs already
lives in this repo's own Postgres database. Building a webhook-ingestion
layer, a Kafka cluster, and a Shopify/Magento connector to pull data *into*
a system that already owns that data is pure waste. Cut entirely, not
deferred:

| Cut from the brief | Why | What replaces it |
|---|---|---|
| Shopify/Magento/ERP/CRM/Salesforce connectors, webhook ingestion layer | OMEcommerce owns the source data directly | Direct read of the OLTP tables + the existing outbox event stream |
| Kafka / Azure Service Bus | This project already has a working, tested event backbone | Existing `OutboxWriter` + `OutboxRelay` (2s poll, `FOR UPDATE SKIP LOCKED`) → BullMQ `domain-events` queue |
| Separate analytics data warehouse (ClickHouse/BigQuery/Snowflake) | No evidence of the volume that would justify one (see §12); the master plan already earmarked `analytics_events` for *partitioning*, not a separate store | Same `public` Postgres schema (same instance) as everything else — `fact_`/`dim_`/`summary_` table-name prefixes provide the logical grouping; revisited only if real production volume proves it's needed |
| New authentication/session system | One already exists and is fully wired into every admin page | Existing `Role`/`Permission`/`RolePermission`/`AdminUserRole` (§8) |
| New CSV/Excel export mechanism | One already exists, tested, and used in production (`orders:export`) | Same same-origin-proxy + `csv-stringify`/`exceljs` pattern, applied to new report types |
| Google Ads / Meta Ads / GA4 / email-platform integrations | Zero tracking infrastructure exists on the storefront today (confirmed: no gtag, no pixel, no UTM capture anywhere) — these aren't "connect an API," they're "build a tracking layer from zero first" | Explicitly **Phase 2, decision required** (§16) — the data model is designed to receive this later without a redesign, but it is not buildable from what exists today |
| Conversion funnel / cart abandonment / session analytics | Same reason — no visitor/session tracking exists at all | Same: Phase 2, needs a first-party event-capture decision (§16) |
| Profitability (gross/net margin) | **No cost/COGS field exists anywhere in the schema** — `Product`, `ProductVariant`, `ProductPrice`, `StockItem` were all checked; none carry a cost basis | Explicitly **Phase 2, blocked on a real decision** (§16) — once a cost source is chosen, the fact tables below already carry the columns needed |

Everything else in the brief — sales/order/product/customer/inventory
analytics, RFM, dashboards, reports, alerts, RBAC-gated access, a
reconciliation job — **is genuinely buildable now** from data this system
already has, and is scoped below against real table/column names, not
placeholders.

---

## 1. KPI dictionary — the brief's 20 questions, answered against reality

| # | Question | Status | Source |
|---|---|---|---|
| 1 | Revenue? | **MVP** | `Order.grandTotal`, `subtotal`, `discountTotal`, `taxTotal`, `shippingTotal` |
| 2 | Orders? | **MVP** | `Order` count by `status`/`financialStatus` |
| 3 | Average Order Value? | **MVP** | `grandTotal` / order count |
| 4 | Best-selling products? | **MVP** | `OrderLine.qty`/`rowTotal` grouped by `variantId` → `Product` |
| 5 | Best-performing categories? | **MVP** | `OrderLine` → `ProductVariant` → `Product` → `ProductCategory` → `Category` |
| 6 | New vs returning customers? | **MVP** | `Order.customerId` + `Order.placedAt`, first-order-date derivation |
| 7 | High-value customers? | **MVP** | RFM on existing `Order` data (recency/frequency/monetary all derivable *today*, no new fields needed) |
| 8 | Low-stock / out-of-stock products? | **MVP** | `StockItem.onHand`/`reorderPoint`, the generated `available` column |
| 9 | Fulfillment performance? | **MVP** | `Order.fulfillmentStatus`, `Fulfillment.shippedAt` vs `Order.placedAt` |
| 10 | Cancellation / return rate? | **MVP** | `Order.status = CANCELLED`, `OrderReturn` |
| 11 | Refund amount? | **MVP** | `PaymentTransaction.type = REFUND` |
| 12 | Marketing-channel revenue? | **Phase 2 — blocked** | `Order` has no UTM/channel/campaign field at all |
| 13 | Conversion rate? | **Phase 2 — blocked** | No visitor/session tracking exists |
| 14 | Cart abandonment rate? | **Phase 2 — blocked** | Same; also no `CartAbandoned` event is emitted today |
| 15 | Customer Lifetime Value? | **MVP (historical only)** | Derivable from `Order` history; a true *predictive* CLV model is Phase 2+ |
| 16 | Customer retention? | **MVP** | Repeat-purchase rate from `Order.customerId`/`placedAt` |
| 17 | Profitability? | **Phase 2 — blocked** | No cost/COGS field anywhere in the schema (checked `Product`, `ProductVariant`, `ProductPrice`, `StockItem`) |
| 18 | Best-performing locations? | **MVP** | `OrderAddress` (state/city on the shipping address) |
| 19 | Failing payment methods? | **MVP** | `PaymentTransaction.status = FAILED` grouped by `method` |
| 20 | What needs attention (alerts)? | **MVP** | Alert engine over the above (§10) |

**14 of 20 are buildable now with zero new source-of-truth fields.** 3
(profitability, marketing attribution, conversion funnel) are genuinely
blocked on decisions/infrastructure that don't exist yet — flagged, not
silently assumed, per §16.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXISTING OLTP WRITE PATH                     │
│  Order/Catalog/Inventory/Customer usecases (unchanged)               │
│    │                                                                  │
│    ├─ writes the business row (order, product, stock_item, ...)      │
│    └─ writes an OutboxEvent row, SAME transaction (OutboxWriter)     │
└────────────────────────────┬──────────────────────────────────────┘
                              │
                    OutboxRelay (existing, 2s poll,
                    FOR UPDATE SKIP LOCKED, jobId dedupe)
                              │
                              ▼
                 BullMQ queue: domain-events (existing)
                              │
        ┌─────────────────────┼─────────────────────┬───────────────┐
        ▼                     ▼                     ▼               ▼
  order-confirmation    search-indexer        loyalty-earn    NEW: analytics-
  .worker.ts (existing) .worker.ts (existing) .worker.ts       projector.worker.ts
                                               (existing)       (this phase)
                                                                     │
                                                    reads the event, applies an
                                                    INCREMENTAL update to the
                                                    matching summary table(s)
                                                    below — never a full
                                                    recompute per event
                                                                     │
                                                                     ▼
                                            ┌─────────────────────────────┐
                                            │  same `public` Postgres      │
                                            │  schema (same DB instance)   │
                                            │  - dim_* / fact_* tables     │
                                            │  - daily summary tables      │
                                            │  - materialized views        │
                                            └───────────┬─────────────────┘
                                                         │
                              NEW: analytics-refresh.worker.ts (BullMQ
                              repeatable job, same pattern as
                              reservation-sweep.worker.ts — nightly full
                              rebuild + catch-up for anything the
                              incremental path missed)
                                                         │
                                                         ▼
                              NEW: src/modules/analytics/ (admin-only
                              REST module, same composition-root shape
                              as every other module — see §9)
                                                         │
                                                         ▼
                              NEW: apps/admin "Reports" nav group —
                              dashboards, reports, alert config
                                                         │
                              NEW: scheduled-report.worker.ts (Phase 2,
                              reuses the existing SMTP sender the order-
                              confirmation email feature already built)
```

**Why a projector worker + summary tables, not "query the OLTP tables live
on every dashboard load":** the brief itself calls this out (§23 of the
original) — and it matches this project's own established discipline:
`get-store-product-detail.usecase.ts` already caches PDP reads, and the
master plan (§4.6) already earmarked `analytics_events` for partitioning
because raw-table aggregation doesn't scale. Two update paths, working
together:
1. **Incremental** (real-time-ish, ~seconds behind): the new
   `analytics-projector.worker.ts` handler applies one event's delta to
   the relevant summary row(s) — an order placed increments today's
   revenue/order-count row, doesn't recompute the whole month.
2. **Batch reconciliation** (nightly, BullMQ repeatable job): recomputes
   yesterday's summary rows from the OLTP tables directly and **overwrites**
   the incremental result — this is what makes the whole system
   self-healing against a missed/duplicate event, and is also the
   reconciliation mechanism (§13).

---

## 3. Event gaps that must close before certain analytics work

The existing outbox stream (confirmed via full grep, see ground-truth
below) covers order lifecycle well but has real gaps. Each gap is a small,
additive change to an existing usecase — not a new subsystem:

| Missing event | Needed for | Where to add it |
|---|---|---|
| `ProductUpdated` (only `ProductCreated`/`ProductAttributeChanged(s)` exist) | Keeping `dim_product` in sync incrementally | `update-product.usecase.ts` — one more `outbox.write()` call, same shape as `create-product.usecase.ts`'s existing one |
| `ProductPriceChanged` | Price-history-aware revenue analytics, price-drop alerts | `set-product-price.usecase.ts` (pricing module) — currently emits nothing at all |
| `StockChanged` | Real-time low-stock alerts, inventory-value tracking | `adjust-stock.usecase.ts` — the inventory module emits **no outbox events today**, confirmed |
| `CustomerRegistered` | New-vs-returning tracking without a full customer-table scan | Wherever `Customer.create` happens in the customer module |
| `CartAbandoned` | Cart abandonment rate (Phase 2, blocked anyway on session tracking — listed here for completeness) | Would need a new scheduled sweep (same shape as `reservation-sweep.worker.ts`) flagging carts inactive N hours past their last update |

None of these block MVP dashboards (§14) — every MVP metric reads from
`OrderPlaced`/`OrderPaid`/`OrderCancelled`/`OrderRefunded`/`OrderClosed`/
`Shipped`, all of which **already exist and already fire correctly**. The
gaps above are what block `dim_product`/inventory analytics from being
fully event-driven on day one; until they're closed, the nightly batch
reconciliation job (§2, path 2) is the source of truth for those tables —
which is a perfectly fine MVP posture, not a hack.

---

## 4. Data model

New schema file `prisma/schema/analytics.prisma`, same `public` Postgres
schema as every other table in this project (this repo's Prisma setup
does not have the `multiSchema` preview feature enabled — confirmed in
`_base.prisma`'s `generator` block — so a genuinely separate Postgres
schema is not a drop-in option today without first taking on that preview
feature as its own decision; not done here). Table-name prefixes
(`fact_`/`dim_`/`summary_`) provide the logical grouping instead, and
nothing stops a real schema-per-namespace split later if `multiSchema` is
adopted project-wide. Follows every existing convention from
`00-master-plan.md` §4 exactly: `BIGINT IDENTITY`
PK + `publicId UUID v7`, `NUMERIC(18,4)` + `CHAR(3)` currency for money,
BRIN on time columns, no soft-delete on append-only facts (same rule
`StockMovement`/`PaymentTransaction` already follow).

### Dimension tables (slowly-changing, small, incrementally synced)

| Table | Grain | Key columns | Synced from |
|---|---|---|---|
| `dim_date` | one row per calendar day, pre-generated for a wide range | `dateKey (PK, YYYYMMDD int)`, `date`, `year`, `quarter`, `month`, `week`, `dayOfWeek`, `isWeekend` | Generated once, static |
| `dim_customer` | one row per `Customer.id` | `customerId (PK, = Customer.id)`, `websiteId`, `email`, `customerGroupId`, `firstOrderAt`, `segment` (nullable, RFM-derived, refreshed nightly) | `Customer` + rollup from `fact_orders` |
| `dim_product` | one row per `Product.id` | `productId (PK)`, `sku`, `nameDefault`, `brandId`, `attributeSetId`, `status` | `Product` |
| `dim_variant` | one row per `ProductVariant.id` | `variantId (PK)`, `productId (FK)`, `sku` | `ProductVariant` |
| `dim_category` | one row per `Category.id`, denormalized ancestor path for fast rollups | `categoryId (PK)`, `nameDefault`, `parentId`, `path` (from the existing `CategoryClosure`) | `Category` + `CategoryClosure` |
| `dim_warehouse` | one row per `Warehouse.id` | `warehouseId (PK)`, `code`, `name`, `type` | `Warehouse` |
| `dim_payment_method` | one row per distinct `(method, gateway)` seen | `id (PK)`, `method`, `gateway` | Derived from `PaymentTransaction` |
| `dim_location` | one row per distinct `(country, stateCode, city)` seen on an `OrderAddress` | `id (PK)`, `country`, `stateCode`, `city` | `OrderAddress` |
| `dim_campaign` | **Phase 2 — schema reserved, not populated** | `id (PK)`, `channel`, `campaignName`, `source`, `medium` | Requires the UTM-capture decision in §16 |

### Fact tables (append-mostly, one row per business event/period)

| Table | Grain | Key columns | Synced from |
|---|---|---|---|
| `fact_orders` | one row per `Order.id`, updated in place as status changes (same pattern `Order` itself already uses — not append-only, this is a 1:1 mirror, not an event log) | `orderId (PK, = Order.id)`, `dateKey (FK)`, `customerId (FK)`, `websiteId`, `status`, `financialStatus`, `fulfillmentStatus`, `subtotal`, `discountTotal`, `taxTotal`, `shippingTotal`, `grandTotal`, `currency`, `placedAt`, `closedAt`, `isFirstOrder` (bool) | `Order` |
| `fact_order_items` | one row per `OrderLine.id` | `orderLineId (PK)`, `orderId (FK)`, `dateKey (FK)`, `variantId (FK)`, `productId (FK)`, `categoryId (FK, primary category)`, `qty`, `unitPrice`, `discountAmount`, `taxAmount`, `rowTotal` | `OrderLine` + variant→product→category resolution |
| `fact_payments` | one row per `PaymentTransaction.id` | `paymentTxnId (PK)`, `orderId (FK)`, `dateKey (FK)`, `paymentMethodId (FK)`, `type`, `status`, `amount`, `currency` | `PaymentTransaction` (already append-only — direct mirror) |
| `fact_refunds` | one row per `PaymentTransaction` where `type = REFUND` | same shape as `fact_payments`, filtered view really — kept as an explicit table for report-query simplicity | `PaymentTransaction` |
| `fact_returns` | one row per `OrderReturnLine.id` | `id (PK)`, `orderReturnId (FK)`, `orderId (FK)`, `dateKey (FK)`, `variantId (FK)`, `qty`, `reason`, `status` | `OrderReturn` + `OrderReturnLine` |
| `fact_inventory_snapshot` | one row per `(variantId, warehouseId, dateKey)` — **daily snapshot**, not per-movement (movement-level detail stays in the existing `StockMovement` ledger, which is already append-only and already the audit trail — no need to duplicate it) | `id (PK)`, `dateKey (FK)`, `variantId (FK)`, `warehouseId (FK)`, `onHand`, `reserved`, `available`, `reorderPoint` | `StockItem`, snapshotted nightly |
| `fact_customer_daily` | one row per `(customerId, dateKey)` with any order activity | `id (PK)`, `dateKey (FK)`, `customerId (FK)`, `ordersPlaced`, `revenue` | Rollup of `fact_orders` |
| `fact_marketing` | **Phase 2 — schema reserved, not populated** | `id (PK)`, `dateKey (FK)`, `campaignId (FK)`, `impressions`, `clicks`, `sessions`, `orders`, `revenue`, `spend` | Requires an ads-platform integration decision |
| `fact_sessions` | **Phase 2 — schema reserved, not populated** | `id (PK)`, `dateKey (FK)`, `sessionId`, `customerId (FK, nullable)`, landing/exit page, funnel stage reached | Requires the session-tracking decision in §16 |

### Pre-aggregated summary tables (what dashboards actually query)

Dashboards never query `fact_*` tables directly for time-series/KPI-card
data — they query these, which the projector/refresh workers keep current:

- `summary_sales_daily (dateKey, websiteId, grossRevenue, netRevenue, discountTotal, taxTotal, shippingTotal, refundTotal, orderCount, unitsSold)`
- `summary_product_daily (dateKey, productId, unitsSold, revenue, orderCount)`
- `summary_category_daily (dateKey, categoryId, unitsSold, revenue)`
- `summary_payment_method_daily (dateKey, paymentMethodId, successCount, failedCount, refundedAmount)`
- `summary_inventory_daily (dateKey, variantId, warehouseId, onHand, daysOfSupply)` — `daysOfSupply` computed against a trailing-30-day sales rate

All keyed by `dateKey` for cheap `BETWEEN` range queries; a **composite
index on `(dateKey, websiteId)`** on every one of them, matching the
`00-master-plan.md` §4.7 indexing baseline.

---

## 5. RFM & customer segmentation (buildable today, no new data)

Nightly job on `fact_orders`, no new source fields required:

- **Recency** — days since `MAX(placedAt)` per customer.
- **Frequency** — `COUNT(orderId)` per customer (financially-settled orders only, i.e. `financialStatus IN (PAID, PARTIALLY_REFUNDED)`).
- **Monetary** — `SUM(grandTotal)` per customer.

Each scored 1–5 (quintile-based, recomputed nightly against the current
customer population), combined into `dim_customer.segment` — a small,
fixed vocabulary (`CHAMPION`, `LOYAL`, `AT_RISK`, `NEW`, `LOST`, etc.,
exact thresholds tunable, not hardcoded into the query). This is exactly
the kind of thing Magento's own "Customer Segments" already does — no
external tool needed for v1.

---

## 6. Dashboards (MVP set — mapped to §1's answerable KPIs only)

Six dashboards ship in MVP, each a new page under a new `apps/admin/src/app/(dashboard)/reports/`
tree, following this app's existing page-per-route + Server-Component-fetch
convention exactly (same shape as every existing `(dashboard)/*` page).

1. **Executive Dashboard** (`/reports`) — KPI cards: Revenue, Orders, AOV,
   New Customers, Refund Rate, Return Rate (profit/conversion-rate cards
   explicitly omitted, not zeroed-out — see §0). Charts: revenue trend
   (line, with prior-period comparison overlay), order-status breakdown
   (donut), top 5 products (bar), top 5 categories (bar). Table: low-stock
   products needing attention.
2. **Sales Dashboard** (`/reports/sales`) — gross/net revenue, discounts,
   tax, shipping, refunds, all with day/week/month/year/custom-range
   comparison (today-vs-yesterday etc., per the brief's §7). Drill into a
   date to see that day's orders.
3. **Order Dashboard** (`/reports/orders`) — status funnel (pending →
   processing → shipped → delivered / cancelled / returned), average
   processing/shipping time, cancellation & return rate trend.
4. **Product Dashboard** (`/reports/products`) — best-sellers, slow-movers,
   revenue by product, drill-down Category → Product → SKU (reuses the
   existing `CategoryClosure` for the rollup).
5. **Customer Dashboard** (`/reports/customers`) — new vs returning trend,
   RFM segment distribution, top customers by spend, retention rate.
6. **Inventory Dashboard** (`/reports/inventory`) — low-stock/out-of-stock
   list (reuses `StockItem.reorderPoint`, already exists), inventory value
   (`onHand × current price`, not cost — flagged), turnover from
   `fact_inventory_snapshot` + sales rate.

**Phase 2 dashboards** (Marketing, Payment-failure-focused,
Returns-deep-dive, Profitability, Geographical) are designed at the schema
level above but not built until their blocking decisions (§16) resolve —
building the UI for data that doesn't exist yet just produces empty
charts, which is worse than not shipping the page.

Charting library: **none currently installed** in `apps/admin` (checked —
confirmed zero charting deps today). Recommend **Recharts** (lightweight,
React-idiomatic, matches this app's existing component style) — load the
`dataviz` skill when this phase actually starts implementation, per this
session's own standing tooling convention, for palette/accessibility/
dark-mode guidance before writing a single chart.

---

## 7. Reports (CSV/Excel, reusing the one existing pattern exactly)

Every MVP dashboard gets a matching downloadable report, built the
**identical** way `orders:export` already works — no new mechanism:

- Backend: `src/modules/analytics/application/export-*.usecase.ts`, one
  per report, each capped at the same `MAX_EXPORT_ROWS = 10_000` with an
  explicit `truncated` flag, using `csv-stringify`/`exceljs` exactly like
  `export-orders.usecase.ts`.
- Frontend: `apps/admin/src/app/api/reports/<name>/export/route.ts`, same
  same-origin session-cookie-forwarding proxy shape as
  `api/orders/export/route.ts`.
- Reports: Daily/Weekly/Monthly Sales, Order Report, Product Report,
  Customer Report, Inventory Report — all MVP. Payment/Refund/Return
  reports are also MVP (their source data exists); Marketing/
  Profitability reports are Phase 2 (blocked, same as their dashboards).
- **Scheduled email reports are Phase 2** — not because they're hard
  (SMTP is already fully wired via the order-confirmation-email feature,
  trivially reusable), but because they need a real scheduling UI +
  BullMQ repeatable-job-per-schedule design that deserves its own focused
  pass rather than being bolted onto MVP scope.

---

## 8. Security / RBAC — reuses the existing system, adds nothing new

The admin app already has a real `Role`/`Permission`/`RolePermission`/
`AdminUserRole` system (`prisma/schema/system.prisma`), currently under-
used (only one role, `super-admin`, exists in practice today). This phase
adds four permission codes to the existing catalog
(`src/modules/auth/domain/permission-catalog.ts`) — nothing else changes:

- `analytics:view` — see dashboards
- `reports:export` — download CSV/Excel (mirrors the existing `orders:export` precedent exactly)
- `reports:schedule` — Phase 2, configure scheduled email reports
- `alerts:manage` — configure alert thresholds/recipients

The brief's requested Admin/Management/Sales/Marketing/Operations/
Inventory/Finance role list is **not** built here — introducing 7 new
roles is a real organizational decision for the merchant to make, not a
default this plan should invent. `RolePermission` already supports
creating them later with zero schema change; flagged as an open question
(§16), not silently assumed.

---

## 9. API design (matches every existing module's shape exactly)

New module `src/modules/analytics/`, same composition-root pattern as
`src/modules/store/store.module.ts` etc.: `domain/repositories.ts` →
`application/*.usecase.ts` → `infrastructure/prisma-*.repository.ts` →
`interface/http/schemas.ts` (Zod) → `analytics.module.ts`, mounted at
`/admin/v1/analytics/*` (admin-only — no `/store/v1` surface; this is
internal business reporting, never customer-facing).

```
GET  /admin/v1/analytics/dashboard/executive?from=&to=&compareTo=
GET  /admin/v1/analytics/sales?from=&to=&groupBy=day|week|month
GET  /admin/v1/analytics/orders?from=&to=&status=
GET  /admin/v1/analytics/products?from=&to=&categoryId=&sortBy=revenue|units
GET  /admin/v1/analytics/customers?from=&to=&segment=
GET  /admin/v1/analytics/inventory?warehouseId=&lowStockOnly=
GET  /admin/v1/analytics/payments?from=&to=&method=
GET  /admin/v1/analytics/returns?from=&to=&reason=

GET  /admin/v1/reports/<name>/export?from=&to=&format=csv|xlsx   (one route per report, mirrors orders:export)

GET  /admin/v1/alerts                 (list configured alert rules)
POST /admin/v1/alerts                 (create a rule: metric, threshold, comparator, recipients)
PATCH /admin/v1/alerts/:id
DELETE /admin/v1/alerts/:id
GET  /admin/v1/alerts/history         (fired-alert log)
```

Every route: `authorize('analytics:view')` (or `reports:export`/
`alerts:manage`), Zod `parse()` on query params — same `asyncHandler` +
RFC 9457 problem+json error shape every other module already returns. No
new auth mechanism, no new error format, no new pagination convention
(reuses the existing `{page, pageSize}` envelope pattern from
`ListProducts`/`ListOrders`).

---

## 10. Alert engine

A new `AlertRule` table (`metricCode`, `comparator`, `threshold`,
`windowDays`, `recipientEmails[]`, `isActive`) evaluated by a BullMQ
repeatable job (`alert-evaluator.worker.ts`, same shape as
`reservation-sweep.worker.ts`) reading the summary tables from §4 — never
raw OLTP tables. MVP alert metrics (all backed by existing/MVP data):

- Revenue dropped >X% vs. the same period last week
- Product below `reorderPoint` (already a real column on `StockItem`)
- Product out of stock (`available = 0`)
- Payment failure rate above X% (trailing 24h)
- Return rate above X% (trailing 7d)
- Order stuck in `PROCESSING` longer than X hours

Fired alerts write an `AlertHistory` row and send via the existing SMTP
sender (same one the order-confirmation feature built) — no new email
infrastructure.

---

## 11. Performance

- **Summary tables + materialized views**, not live aggregation — §2/§4.
- **Composite indexes** on every summary table's `(dateKey, ...)` — §4.
- **BRIN** on `fact_*` time columns, matching the existing `Order`/
  `StockMovement` convention exactly (`00-master-plan.md` §4.6/§4.7).
- **No partitioning yet.** The master plan itself defers `orders`/
  `stock_movements` partitioning until real volume justifies it (§4.6,
  "partition only when measured") — `analytics`'s fact tables inherit the
  identical posture. This is a documented, deliberate non-decision, not
  an oversight.
- **Redis caching**: only for the Executive Dashboard's default (no
  filter) view, short TTL (~60s) — everything else queries the already-
  cheap summary tables directly. Matches the brief's own "only if
  actually required" instruction.

---

## 12. Reconciliation

Reframed from the brief's "compare against the source platform" (there is
no separate source platform) to what's actually meaningful here: **prove
the analytics read-model agrees with the OLTP tables it was derived
from.** Daily job, same time as the nightly batch refresh (§2):

```
Source (OLTP):     SELECT count(*), sum(grand_total) FROM "order"
                    WHERE placed_at::date = $yesterday
Analytics:          SELECT order_count, gross_revenue FROM summary_sales_daily
                    WHERE date_key = $yesterday
```

Any mismatch → `ReconciliationLog` row (`table`, `dateKey`, `expected`,
`actual`, `diff`) + an alert (§10). Same technique applied to
`fact_order_items` vs `OrderLine`, `fact_payments` vs `PaymentTransaction`,
`fact_inventory_snapshot` vs `StockItem`. This is what makes the
incremental projector (§2 path 1) safe to run in near-real-time without
needing to be perfect — the nightly batch pass is the actual source of
truth, and any drift between the two is surfaced, not hidden.

---

## 13. Development roadmap

| Phase | Deliverable | Depends on |
|---|---|---|
| 19.1 | `analytics.prisma` schema (§4) + migration, reviewed by `schema-reviewer` + `db-migration-verifier` (this repo's standing convention for every schema change) | — |
| 19.2 | Close the event gaps in §3 (add the missing `outbox.write()` calls) | 19.1 |
| 19.3 | `analytics-projector.worker.ts` (incremental) + `analytics-refresh.worker.ts` (nightly batch/reconciliation, §12) | 19.1, 19.2 |
| 19.4 | `src/modules/analytics/` REST module (§9) | 19.3 |
| 19.5 | Executive + Sales + Order dashboards (admin UI) | 19.4 |
| 19.6 | Product + Customer + Inventory dashboards, RFM (§5) | 19.4 |
| 19.7 | Reports/export (§7) | 19.4 |
| 19.8 | Alert engine (§10) | 19.4 |
| 19.9 | Live verification (curl + Puppeteer, this session's standing discipline) + integration tests | 19.5–19.8 |
| 19.10 | Deploy script (`deploy/deploy-analytics-*.sh`, following this repo's per-feature deploy-script convention) | 19.9 |

Phase 2 (blocked on §16 decisions, not scheduled until they resolve):
UTM/session-tracking capture → Marketing dashboard + conversion funnel;
Product cost field → Profitability dashboard; Scheduled email reports;
Geographical dashboard (data exists via `OrderAddress` but was left out
of MVP purely for scope control, not a blocker — could move into 19.6 if
prioritized).

---

## 14. MVP scope (explicit)

**In:** Executive, Sales, Order, Product, Customer, Inventory dashboards;
matching CSV/Excel reports; date-range filters + period comparisons; RFM
segmentation; low-stock/payment-failure/return-rate/revenue-drop alerts;
`analytics:view`/`reports:export`/`alerts:manage` permissions on the
existing RBAC system; nightly reconciliation job.

**Out (Phase 2, listed with its exact blocker):** Marketing/channel
analytics (needs a tracking-layer decision), conversion funnel/cart
abandonment (same), profitability/margin (needs a cost-data-source
decision), scheduled email reports (needs a scheduling-UI design pass),
geographical dashboard (data exists, purely deferred for scope), 7-role
RBAC expansion (needs the merchant's actual org-chart decision), any move
off single-Postgres-instance analytics (needs real production volume
data first).

---

## 15. Trade-offs

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Analytics store | Same Postgres instance, same `public` schema, prefixed table names | Separate warehouse (ClickHouse/BigQuery) | No volume evidence justifies the operational cost yet; migrating out later is a table-by-table move, not a rewrite, whenever that's actually warranted |
| Event backbone | Existing Outbox + BullMQ | Kafka | Already built, tested, and proven under this project's other async features; introducing a second event system for one bounded context is pure duplication |
| Ingestion model | Direct OLTP read + own event stream | Webhook ingestion from an external platform | OMEcommerce is the source system, not a consumer of one |
| RFM/segmentation | Rule-based quintile scoring, nightly | ML-based predictive scoring | Matches this project's stated "don't pay complexity tax by default" principle (`00-master-plan.md` §1.7-adjacent CQRS note); revisit if the merchant specifically wants predictive CLV |
| Real-time-ness | Near-real-time (incremental projector, seconds-to-low-minutes behind) + nightly authoritative reconciliation | True streaming/sub-second | No stated business requirement for sub-second dashboards; matches the outbox relay's own existing 2s poll cadence |

---

## 16. Open Questions / Decisions Required

Per this plan's own instruction to never assume silently:

1. **UNKNOWN — Expected order volume** (daily and historical). Nothing in
   `seed.ts` or any doc comment states a real production figure; this
   determines whether §11's "no partitioning yet" posture is actually
   safe to ship with.
2. **UNKNOWN — Product cost/COGS source.** No field exists today. Options:
   (a) new `Product.cost` field, manually entered per-SKU in the admin
   product form and via the bulk CSV import this session already built
   (`attr:` columns don't apply here — a real new schema field is
   needed); (b) sourced from an external ERP (none exists today); (c)
   deferred indefinitely. **Needs a decision before Profitability can be
   scheduled at all.**
3. **UNKNOWN/DECISION — Marketing attribution approach.** Build first-
   party UTM capture (new `Order.utmSource`/`channel` columns + storefront
   capture on checkout), or integrate GA4/Google Ads/Meta Ads APIs
   (needs API keys/accounts the user must provide), or both, or skip.
4. **UNKNOWN/DECISION — Session/visitor tracking for the conversion
   funnel.** First-party (`fact_sessions`, a new lightweight event-capture
   route on the storefront) vs. GA4 vs. skip entirely. This is a real
   product decision (privacy/consent implications too), not a technical
   one.
5. **UNKNOWN — Report recipients.** Who receives scheduled reports once
   Phase 2 builds them (roles, specific people, distribution lists)?
6. **UNKNOWN — Data retention period** for `analytics` schema tables (and
   whether it differs from the OLTP retention policy already implied by
   soft-delete + a documented-but-unbuilt purge job in
   `00-master-plan.md` §4.2).
7. **DECISION — RBAC role expansion.** Ship with just the 4 new
   permission codes on the existing single `super-admin` role (§8), or
   actually stand up the brief's 7-role list (Admin/Management/Sales/
   Marketing/Operations/Inventory/Finance) now? This is an organizational
   decision, not a technical blocker either way.
8. **DECISION — Multi-website scope.** The schema is website-scoped
   throughout (future-proof), but only one website is deployed today.
   Confirm dashboards should default to "current website" with no
   cross-website rollup UI in MVP (assumed here, not confirmed).
9. **DECISION — Geographical dashboard priority.** Data already exists
   (`OrderAddress`); purely a scope call whether it ships in MVP (§14) or
   Phase 2.
10. **DECISION — Alert delivery channel.** Email only (reuses existing
    SMTP), or also Slack/webhook? Brief didn't specify; email assumed as
    the MVP default.

---

## 17. Estimated effort (rough, phase-by-phase — confirm against actual team size/velocity, not a hard commitment)

| Phase | Rough size |
|---|---|
| 19.1 Schema + migration | Small — mirrors existing patterns closely |
| 19.2 Close event gaps | Small — additive `outbox.write()` calls to existing usecases |
| 19.3 Projector + refresh workers | Medium — the core new logic |
| 19.4 REST module | Small — pure boilerplate over an established shape |
| 19.5–19.6 Dashboards (6 pages) | Large — the bulk of the UI work, one dashboard at a time per this project's own "work module by module" convention |
| 19.7 Reports/export | Small — direct copy of an existing, working pattern |
| 19.8 Alerts | Medium |
| 19.9 Verification | Ongoing throughout, not a separate block — matches this session's own live-verify-every-feature discipline |

No day/week estimates given — this repo has no historical velocity data to
calibrate against; sizing is relative (Small/Medium/Large) only.

# OMEcommerce — Enterprise E-commerce Platform: Master Plan

> **Positioning:** Shopify's simplicity + Magento's flexibility, on a modern
> PostgreSQL + Node.js/TypeScript stack. **Single-tenant** (dedicated DB, server,
> and deployment per client) — but internally **multi-store** (Magento-style
> Website → Store → Store View hierarchy).

**Author role:** Senior Solution Architect / Database Architect / Enterprise E-commerce Expert
**Stack:** PostgreSQL 16 · Prisma · Node.js · Express · TypeScript · Redis · OpenSearch · MinIO/S3 · BullMQ · Docker
**Architecture:** Clean Architecture · DDD · CQRS (selective) · Event-Driven

---

## 0. How to read this plan

The design is delivered in **9 phases**, each in its own file under `plan/`.
This master document holds the cross-cutting decisions, the north-star principles,
and the index. Each phase file is self-contained and ends with a **trade-offs**
and **platform comparison** section (Shopify, Magento 2, WooCommerce, Saleor,
Medusa, commercetools).

| Phase | File | Deliverable |
|------|------|-------------|
| — | `00-master-plan.md` | This document: principles, glossary, decisions log |
| 1 | `01-domain-model-and-erd.md` | Domain model, bounded contexts, ER diagram, schema narrative |
| 2 | `02-prisma-schema-and-migrations.md` | Prisma schema strategy, migration & seeding strategy |
| 3 | `03-rest-api-design.md` | REST/API-first design, versioning, contracts |
| 4 | `04-admin-module.md` | Admin (merchant) module design |
| 5 | `05-storefront-apis.md` | Storefront (buyer-facing) APIs |
| 6 | `06-search-architecture.md` | OpenSearch indexing, faceting, sync |
| 7 | `07-inventory-architecture.md` | Multi-warehouse, reservations, stock ledger |
| 8 | `08-order-management.md` | Cart→Checkout→Order→Fulfillment lifecycle |
| 9 | `09-deployment-architecture.md` | Docker, scaling, caching, CDN, observability |
| 10 | `10-gift-cards-wallet-store-credit.md` | Stored value: gift cards, customer wallet, store credit (ledger-based) |
| 11 | `11-loyalty-and-referral.md` | Loyalty points/tiers + referral program (built on the stored-value ledger) |

> **Build order recommendation:** 1 → 2 → 7 (inventory ledger) → 8 (orders) →
> 3/5 (APIs) → 6 (search) → 4 (admin) → 10 (stored value) → 11 (loyalty/referral) →
> 9 (deploy). Inventory and orders are the financial core; get their invariants right
> before surface area grows. Stored value (Phase 10) reuses the inventory ledger
> pattern and the order tender model; loyalty/referral (Phase 11) reuses the
> stored-value ledger and issues rewards through it — so build them in that order.

---

## 1. North-star principles

1. **Single-tenant, multi-store.** No `tenant_id` smeared across every table.
   Instead a clean scope hierarchy (Website → Store → StoreView). This is the
   single most important architectural decision and it echoes through every table.
2. **EAV only where it earns its keep.** Magento's fully-generic EAV is a
   performance tax on *every* read. We use a **hybrid model**: a strongly-typed
   core product table + a **modernized, indexed attribute-value model** for the
   flexible catalog, + **JSONB metafields** for the truly free-form long tail.
   (Detailed rationale in Phase 1 §Catalog.)
3. **Scope resolution is a first-class concept.** Every scoped value (price,
   inventory, attribute value, CMS content, SEO) resolves via the same rule:
   `Store View override → Store → Website → Global default`. One resolver, reused.
4. **The stock ledger is append-only truth.** Current quantity is a *projection*
   of an immutable movement log. This makes inventory auditable and reservations
   race-safe. (Phase 7.)
5. **Money is never a float.** All monetary values are `NUMERIC(18,4)` (or minor
   units as `BIGINT` where performance-critical) + an explicit ISO-4217 currency.
6. **Soft delete + audit + versioning are cross-cutting**, applied uniformly (§4).
7. **API-first.** The admin UI and storefront are just clients of the same
   versioned API surface. Read models are denormalized/cached; writes go through
   the domain.
8. **CQRS only where read and write shapes genuinely diverge** (catalog browse,
   search, analytics). Everywhere else, one model. Don't pay the CQRS tax by default.

---

## 2. Glossary & scope hierarchy

```
Website           e.g. "US Business", "EU Retail"
  └─ Store         a catalog/brand grouping (Magento "Store Group")
       └─ StoreView   a locale/currency presentation (Magento "Store View")
```

- **Website** — top of the scope tree. Owns a customer base, a base currency, a
  root of websites-level config (payment, tax jurisdiction defaults).
- **Store** — a catalog scope. Selects a **root category** and a **default
  StoreView**. One Website → many Stores.
- **Store View** — the presentation layer: language, currency, theme, localized
  CMS/SEO. One Store → many Store Views. This is what a shopper actually "is in".

**Scope enum** used on every overridable value:
`GLOBAL | WEBSITE | STORE | STORE_VIEW`.

**Resolution order (most specific wins):** `STORE_VIEW → STORE → WEBSITE → GLOBAL`.

> This mirrors Magento but with **explicit tables and FKs** instead of Magento's
> `store_id = 0 means default` magic-number convention. Cleaner, self-documenting,
> and index-friendly.

---

## 3. Bounded contexts (DDD)

Each becomes a module (Clean Architecture: `domain / application / infrastructure /
interface` layers) and, roughly, a schema namespace.

| Context | Owns | Emits key events |
|--------|------|------------------|
| **Catalog** | Products, variants, attribute sets, categories, metafields, media links | `ProductPublished`, `VariantCreated`, `PriceChanged` |
| **Pricing** | Price lists, tier/group/B2B prices, special/scheduled prices, currency | `PriceListUpdated` |
| **Inventory** | Warehouses, stock ledger, reservations, adjustments | `StockMoved`, `StockReserved`, `LowStock` |
| **Customer** | Customers, groups, addresses, auth | `CustomerRegistered`, `GroupChanged` |
| **Cart & Checkout** | Cart, line items, quote totals, checkout sessions | `CartUpdated`, `CheckoutStarted`, `CheckoutAbandoned` |
| **Order** | Orders, fulfillments, shipments, invoices, returns | `OrderPlaced`, `OrderPaid`, `Shipped`, `Refunded` |
| **Promotion** | Cart rules, catalog rules, coupons | `PromotionApplied`, `CouponRedeemed` |
| **Stored Value** (Phase 10) | Gift cards, customer wallet, store credit — append-only value ledgers, order tenders | `GiftCardIssued/Redeemed`, `WalletCredited/Debited`, `StoreCreditIssued` |
| **Tax** | Tax classes, rates, rules, jurisdictions | `TaxCalculated` |
| **Shipping** | Carriers, methods, zones, rates | — |
| **Payment** | Payment methods, transactions, gateways | `PaymentCaptured`, `PaymentFailed` |
| **CMS** | Pages, blocks, widgets, blogs | `ContentPublished` |
| **Marketing** | Campaigns, abandoned cart, email/notification triggers | `CampaignTriggered` |
| **Loyalty & Referral** (Phase 11) | Points ledger, earn rules, tiers, referral tracking, shared reward issuer | `LoyaltyPointsEarned/Redeemed`, `TierUpgraded`, `ReferralQualified/Rewarded` |
| **Search** | Index projections, synonyms, boosts | consumes catalog/inventory events |
| **SEO** | URL rewrites, redirects, meta, structured data, sitemap | `UrlRewritten` |
| **Media** | Asset registry (MinIO/S3), transforms, variants | `MediaUploaded` |
| **Analytics** | Read-model aggregates, dashboards | consumes all events |
| **Store Config** | Website/Store/StoreView, settings, feature flags | `ConfigChanged` |
| **Localization** | Languages, currencies, translations, RTL | — |
| **Reviews / Wishlist** | Buyer-generated content | `ReviewSubmitted` |

**Integration between contexts is event-driven** (BullMQ + an outbox table).
Search, analytics, and SEO are *downstream projections* — they never block a write.

---

## 4. Cross-cutting strategies (apply everywhere)

### 4.1 Primary keys
- **`BIGINT GENERATED ALWAYS AS IDENTITY`** for internal PKs (compact, index-friendly,
  sortable) **+ a `public_id UUID` (v7)** column for external API exposure.
- Rationale: don't leak row counts or invite enumeration; don't pay UUID's index-
  bloat cost on every internal join. UUIDv7 is time-sortable, good for external
  ordering. (This is the Medusa/commercetools instinct, done more carefully.)

### 4.2 Soft delete
- `deleted_at TIMESTAMPTZ NULL` on all business entities.
- **Partial indexes** `WHERE deleted_at IS NULL` keep the hot path fast.
- Prisma: global soft-delete via a client extension + default `where` filter.
- Hard-delete only via a scheduled purge job for GDPR/retention.

### 4.3 Audit
- Every table: `created_at`, `updated_at`, `created_by`, `updated_by`.
- **`audit_log`** table (partitioned by month) capturing `entity_type, entity_id,
  action, actor_id, diff JSONB, at`. Written via DB triggers for money/stock/price
  tables (guaranteed) and via the app layer elsewhere.

### 4.4 Versioning
- **Content-style versioning** (products, CMS, prices): a `*_version` table holding
  immutable snapshots + a pointer to the "published" version. Enables drafts,
  scheduled publish, rollback, and audit-by-design.
- **Optimistic concurrency**: `version INT` (row-version) on aggregates that get
  concurrent writes (cart, order, stock item) → `UPDATE ... WHERE version = $expected`.

### 4.5 Money & currency
- `NUMERIC(18,4)` + `currency CHAR(3)`. A shared `Money` value object in the domain.
- FX handled by Pricing context: base price + per-currency price list or a
  conversion snapshot captured at order time (never re-convert historical orders).

### 4.6 Partitioning
- **Range-partition by time** the high-volume append tables: `orders` (by
  `created_at` month/quarter), `stock_movements`, `audit_log`, `analytics_events`,
  `cart` (short-lived, partition + drop old).
- **List/hash consideration** for `product_attribute_value` if it grows huge — but
  start with good composite indexes; partition only when measured.

### 4.7 Indexing baseline
- FK columns always indexed.
- Composite indexes ordered by selectivity + query shape (examples in each phase).
- **GIN** on JSONB metafields (`jsonb_path_ops`) and on `tsvector` fallback search.
- **Partial** indexes for `deleted_at IS NULL`, `status = 'active'`, low-stock.
- **BRIN** on huge append-only time columns (orders, movements) — cheap and effective.

### 4.8 Idempotency & outbox
- All state-changing API calls accept an `Idempotency-Key` → `idempotency_keys` table.
- **Transactional outbox**: domain writes + event row in one TX; a relay ships to
  BullMQ. Guarantees no lost events without 2-phase commit.

---

## 5. The catalog decision (the heart of the platform)

Because you explicitly want "better than Shopify" and "modernized Magento attribute
sets, NOT flat metafields," Phase 1 commits to a **three-tier catalog model**:

1. **Typed core** — `product` table with the always-present columns (sku, name,
   type, status, tax_class, weight, etc.). Fast, relational, joinable.
2. **Structured attributes (modernized EAV)** — `attribute_set → attribute_group →
   attribute → attribute_option`, with values stored in **type-partitioned value
   tables** (`product_attribute_value_text/int/decimal/datetime/bool/ref`) that are
   **scoped** (Global/Website/Store/StoreView) and **indexable** for layered nav.
   This is Magento's power without Magento's `catalog_product_entity_*` sprawl,
   because attributes carry rich flags (filterable, variant-forming, etc.) and the
   value tables are lean and individually indexable.
3. **Metafields (Shopify-style)** — `metafield_definition` + `metafield_value`
   (JSONB, namespaced, scoped, versioned) for the free-form long tail (AR model,
   FAQs, warranty PDF, specs JSON) where schema rigor isn't wanted.

**Why hybrid beats picking one:**
- Pure JSONB (Shopify/Medusa-ish) → can't do performant, correct layered navigation
  / faceting / sortable typed attributes at 5M products.
- Pure EAV (Magento) → every PDP is a dozen joins; indexing/faceting is painful;
  the schema is generic to the point of opacity.
- **Hybrid** → typed & indexed where you query/filter/sort; free-form where you don't.
  Search (OpenSearch) is the *fast* faceting path; the DB model is the *correct*
  source of truth. (commercetools and Saleor both lean this direction; we go further
  on the attribute-set ergonomics.)

Full tables, types, and the attribute-feature matrix are in Phase 1.

---

## 6. Product types

| Type | Model | Notes |
|------|-------|-------|
| **Simple** | 1 product, 1 implicit variant | Baseline. |
| **Variable / Configurable** | 1 parent + N variants via `product_variant`, driven by **variant-forming attributes** (Color, Size, RAM…) | Configurable = Magento term; Variable = Woo/Shopify term. Same model. |
| **Bundle** | `product_bundle_item` linking a bundle parent to component products + selection rules (fixed/dynamic price, qty) | Kits. |
| **Digital** | Simple + `is_digital`, downloadable asset grant on purchase | No shipping. |
| **Virtual** | Service/warranty — no shipping, no download | e.g. installation. |

Variants carry their own SKU, barcode, price override, weight, images, and
inventory. (Phase 1 §Variants, Phase 7 for their inventory.)

---

## 7. Technology decisions log (ADR-style summary)

| # | Decision | Chosen | Rejected | Why |
|---|----------|--------|----------|-----|
| 1 | Multi-store model | Explicit Website/Store/StoreView tables | tenant_id column; Magento magic store_id=0 | Self-documenting, index-friendly, matches mental model |
| 2 | Catalog | Hybrid typed + modern-EAV + JSONB | Pure EAV / pure JSONB | Correct *and* fast at 5M SKU |
| 3 | PK | BIGINT identity + public UUIDv7 | Pure UUID PK / pure serial | Join speed + safe external IDs |
| 4 | Inventory | Append-only ledger + projection | Mutable qty column | Auditable, race-safe reservations |
| 5 | Search | OpenSearch as read projection | Postgres-only faceting | Facets/relevance at scale |
| 6 | Events | Outbox → BullMQ | Direct publish / Kafka | No lost events, no Kafka ops overhead for single-tenant |
| 7 | CQRS | Selective (browse/search/analytics) | Global CQRS | Avoid complexity tax |
| 8 | Money | NUMERIC(18,4)+currency | float / int-cents-only | Correctness + FX history |
| 9 | ORM | Prisma (+ raw SQL escape hatch for hot reads) | TypeORM / Knex-only | DX + type safety; raw where Prisma is weak |
| 10 | Media | MinIO/S3 + `media_asset` registry | BLOB in DB | Scale, CDN offload |

> Prisma caveat recorded now, resolved in Phase 2: Prisma's EAV ergonomics and
> some composite-index / partial-index / partitioning features need **raw SQL
> migrations** and **typed raw queries** for hot read paths. We embrace that rather
> than fight the ORM.

---

## 8. Performance targets & how the design meets them

| Target | Mechanism |
|--------|-----------|
| 5M products | Typed core + indexed attribute values; OpenSearch for browse/facet; Redis for PDP cache; read replicas |
| 50M orders | Time-partitioned `orders`/`order_line`; BRIN indexes; archival partitions; analytics on a separate read model |
| 500K customers | Trivial for PG; index on email/group; partition not needed |
| High read traffic | CQRS read models, Redis cache-aside, CDN for media & cacheable storefront GETs, read replicas |
| Horizontal scaling | Stateless API pods; PgBouncer; read replicas; OpenSearch cluster; Redis; BullMQ workers scale independently |
| Background jobs | BullMQ (indexing, emails, abandoned cart, price schedules, sitemap, media transforms) |
| Caching | Redis (cache-aside + resolved-scope cache); HTTP cache headers; OpenSearch |
| CDN | MinIO/S3 behind CDN; storefront edge caching of anonymous GETs |

---

## 9. Open questions to confirm before Phase 1 build

1. **B2B depth** — do you need quotes/RFQ, purchase-on-account, company hierarchies?
   (Affects Customer + Pricing + Order.) Assumed: tier/group/wholesale pricing yes,
   full B2B quoting *later*.
2. **Currency at order time** — capture FX snapshot per order (recommended) vs.
   store base + convert on display?
3. **Tax engine** — native rules table vs. pluggable (Avalara/TaxJar) adapter?
   Design supports both; default native + adapter interface.
4. **Search engine** — OpenSearch (assumed, AWS-friendly) vs. Elasticsearch. The
   design is engine-agnostic behind a `SearchPort`.
5. **Publish/versioning depth** — do merchants need full draft/scheduled workflows
   for products on day one, or just for CMS? (Affects how many `*_version` tables.)

Answers refine Phase 1; none block starting the domain model.

---

*Next: open `plan/01-domain-model-and-erd.md`.*

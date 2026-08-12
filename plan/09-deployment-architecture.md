# Phase 9 — Deployment Architecture

> Single-tenant: **one dedicated deployment per client** (own DB, own server/cluster).
> This phase covers topology, scaling, caching, CDN, jobs, observability, and the
> analytics read model — sized for 5M products / 50M orders / high read traffic.

---

## 1. Topology

```
                         ┌─────────── CDN (media + cacheable storefront GETs) ───────────┐
                         │                                                               │
   Clients ─► Load Balancer / API Gateway (TLS, WAF, rate-limit)
                         │
        ┌────────────────┼───────────────────────────────┐
        ▼                ▼                                ▼
   API pods (Express)   Storefront BFF (optional)     Admin SPA (static)
        │  stateless, autoscaled
        ▼
   PgBouncer ─► PostgreSQL primary ──► read replicas (browse/analytics reads)
        │
        ├─► Redis (cache, sessions, rate-limit, BullMQ broker)
        ├─► OpenSearch cluster (catalog/search/order-admin indexes)
        ├─► MinIO / S3 (media, documents, backups)
        └─► BullMQ workers (indexing, emails, jobs, partitions, sitemaps)
```

Everything is containerized (**Docker**); orchestrated with Docker Compose (small
clients) or Kubernetes (large clients). Same images, different scale.

---

## 2. Compute & scaling

| Component | Scaling | Notes |
|-----------|---------|-------|
| **API pods** | Horizontal, stateless | No session affinity (state in Redis/DB); autoscale on CPU/RPS |
| **BullMQ workers** | Horizontal, per-queue | Separate deployments per queue class (indexing vs. email vs. heavy exports) so a slow queue can't starve others |
| **PostgreSQL** | Vertical primary + **read replicas** | Writes → primary; browse/PDP/analytics reads → replicas via a routing layer |
| **PgBouncer** | Connection pooling | Transaction-mode pooling; caps DB connections under pod autoscale |
| **OpenSearch** | Cluster (3+ nodes) | Dedicated master + data nodes; per-store-view indices |
| **Redis** | Primary + replica / cluster | Cache + broker; consider separate instances for cache vs. queue at scale |

**Read/write split** is the main lever for "high read traffic": replicas absorb
catalog/browse/search-fallback/analytics; primary handles carts/checkout/orders/admin.

---

## 3. Caching strategy (layered)

```
Edge (CDN)         → media, anonymous storefront GETs (vary: store-view, currency)
App (Redis)        → cache-aside: PDP projections, resolved prices, category trees,
                     scope-resolved config, session, cart
Query (OpenSearch) → PLP/facets/search (itself a cache of catalog truth)
DB                 → source of truth; hot rows kept warm
```
- **Invalidation is event-driven** (from the outbox): `PriceChanged`/`StockMoved`/
  `ProductPublished`/`ConfigChanged` invalidate specific keys — never blanket flush.
- Resolved-scope values (the Website→Store→StoreView fallbacks) are cached per
  store-view to avoid recomputing the resolver on every request.

---

## 4. Background jobs (BullMQ queues)

| Queue | Jobs |
|-------|------|
| `search-index` | product/price/stock reindex, full rebuild, embeddings |
| `media` | image transforms/renditions, video processing |
| `email`/`notify` | order emails, low-stock, abandoned cart, campaigns |
| `commerce` | reservation expiry sweep, scheduled price/publish flips, dynamic-collection materialization |
| `maintenance` | partition manager, inventory reconcile, sitemap regen, backfills, old-cart purge, GDPR purge |
| `webhooks` | outbound signed webhook delivery with retry/backoff/DLQ |
| `analytics` | event → read-model aggregation |

All queues have retry + exponential backoff + **dead-letter queue**; the **transactional
outbox relay** moves committed domain events into these queues (no lost events).

---

## 5. Analytics read model (serves the Dashboard)

Analytics **never touches OLTP order tables**. Instead:
```
Domain events (OrderPaid, Shipped, Refunded, StockMoved, ProductViewed, …)
   → analytics queue → aggregate tables (partitioned, append/rollup):
       sales_daily(store_view, date, revenue, orders, units, aov)
       product_perf(product, period, views, add_to_cart, units, revenue)  → top-selling
       customer_perf(customer, ltv, orders, last_order)                   → best customers
       conversion_funnel(period, sessions, carts, checkouts, orders)
       inventory_snapshot(warehouse, date, on_hand, value)
       stored_value_liability(website, date, giftcard_outstanding, wallet_outstanding, breakage)  // Phase 10
       loyalty_liability(website, date, points_outstanding, points_value, redemption_rate)         // Phase 11
       referral_perf(program, period, invites, signups, qualified, reward_cost, CAC, ROI)          // Phase 11
```
- Powers Dashboard / Sales / Revenue / Orders / Products / Customers / Conversion /
  Traffic / Inventory / Top-Selling / Best-Customers requirements.
- Heavy ad-hoc analytics can run on a read replica or be exported to a warehouse
  (ClickHouse/BigQuery) if a client needs BI — the event stream makes that a plug-in.

---

## 6. Storage, backups, DR

- **PostgreSQL:** PITR via WAL archiving to S3; nightly base backups; tested restore.
  Partition-aware archival for cold order/movement partitions.
- **OpenSearch:** snapshots to S3; fully rebuildable from PG (index is derived).
- **MinIO/S3:** versioned buckets, lifecycle policies, CDN-fronted.
- **Redis:** cache is disposable; queue data persisted (AOF) or accepted-as-loss with
  outbox as backstop.
- **RPO/RTO:** RPO minutes (WAL); RTO defined per client SLA. Single-tenant makes
  per-client DR isolation clean.

---

## 7. Environments & delivery

- **Per-client:** `dev → staging → prod`, identical images, config via env/secrets.
- **CI/CD:** build image → run tests + `prisma migrate diff` drift check → deploy to
  staging → smoke tests → promote. `prisma migrate deploy` (never `dev`) in prod;
  expand/migrate/contract for schema changes (Phase 2).
- **Config & secrets:** 12-factor; secrets via vault/secret manager; feature flags in
  `store config`.
- **Zero-downtime deploys:** rolling API pods; migrations backward-compatible within a
  release; index changes via alias swap.

---

## 8. Observability & security

- **Logs:** structured JSON, correlation via `traceId` (W3C traceparent end-to-end).
- **Metrics:** RED (rate/errors/duration) per endpoint + queue depth, DB pool,
  cache hit ratio, index lag, reservation-sweep age.
- **Tracing:** OpenTelemetry across API → DB/Redis/OpenSearch/queues.
- **Alerts:** projection-drift (inventory reconcile), index lag, DLQ growth, payment
  failure rate, p99 latency, low disk on partitions.
- **Security:** WAF + rate limits; RBAC; secrets management; PCI scope minimized by
  tokenized gateways (no PAN stored); GDPR export/erase jobs; audit log; encrypted at
  rest + TLS in transit.

---

## 9. Trade-offs

- **Single-tenant per client** trades infra density/cost for isolation, security,
  per-client scaling, and blast-radius containment — exactly what enterprise buyers
  want, and it removes `tenant_id` complexity from the entire schema. The cost is more
  deployments to operate → mitigated by identical Docker images + IaC templating.
- **Read replicas + eventual-consistency caches/indexes** add moving parts and a small
  staleness window; the payoff is the read throughput the targets demand.
- **Separate analytics read model** duplicates data but protects OLTP and enables BI
  without hammering the order tables.

## 10. Platform comparison

| Concern | Shopify | Magento 2 | WooCommerce | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|---------|-----------|-------------|--------|--------|---------------|-----------------|
| Tenancy | SaaS multi-tenant | Self-host (single) | Self-host (single) | Self/cloud | Self-host | SaaS multi-tenant | **Single-tenant, dedicated per client** |
| Scaling model | Managed | Manual (Varnish/Redis/split DB) | Poor | K8s | K8s/Node | Managed | **Stateless pods + replicas + OpenSearch + BullMQ** |
| Jobs | Managed | Cron/queues (message queue consumers) | WP-cron (weak) | Celery | Bull/queues | Managed | **BullMQ, per-queue scaling, outbox relay** |
| Analytics | Managed | Reports on OLTP (heavy) | Weak | External | External | Managed | **Event-sourced read model, warehouse-ready** |
| DR/backup | Managed | Self-managed | Self-managed | Self | Self | Managed | **PITR + rebuildable index + S3 snapshots** |

---

## Appendix — full plan index

1. `00-master-plan.md` — principles, scope model, decisions
2. `01-domain-model-and-erd.md` — domain, ERD, schema (catalog-deep)
3. `02-prisma-schema-and-migrations.md` — Prisma + migration strategy
4. `03-rest-api-design.md` — API-first contract
5. `04-admin-module.md` — merchant back-office
6. `05-storefront-apis.md` — buyer-facing APIs
7. `06-search-architecture.md` — OpenSearch projection
8. `07-inventory-architecture.md` — ledger + reservations
9. `08-order-management.md` — order lifecycle
10. `09-deployment-architecture.md` — this file
11. `10-gift-cards-wallet-store-credit.md` — stored value (gift cards, wallet, store credit)
12. `11-loyalty-and-referral.md` — loyalty points/tiers + referral program

**Recommended build order:** 1 → 2 → 7 → 8 → 3/5 → 6 → 4 → 10 → 11 → 9. Nail inventory
and order invariants first; grow surface area outward from the financial core. Stored
value (Phase 10) reuses the inventory-ledger pattern and the order tender model;
loyalty/referral (Phase 11) reuses the stored-value ledger and issues rewards through it.

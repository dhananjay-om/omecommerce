# Phase 12 — Development Sequence (How to actually build this)

> You have the design (Phases 1–11) and a validated Foundation schema. This document
> is the **execution order**: what to build, in what sequence, so you always have a
> runnable system and never stack code on unproven foundations.

---

## 1. Three principles that decide the order

1. **Walking skeleton first.** Before any feature, get an *empty but runnable* system
   with every piece of infra wired together (DB, Redis, OpenSearch, MinIO, Express, one
   health endpoint, one real migration, CI, one passing test). This de-risks integration
   once, up front — the most common cause of "3 months in and nothing runs together."
2. **Vertical slices, not horizontal layers.** Don't build "all repositories", then
   "all services", then "all controllers". Build **one context fully through every
   layer** (domain → application → infra → interface → tests), ship it, then the next.
   Each slice proves the architecture and delivers working behavior.
3. **Build order follows financial risk, not the module list.** Inventory and orders
   carry money invariants; get them right early while the surface is small. This is the
   plan's recommended order: `1 → 2 → 7 → 8 → 3/5 → 6 → 4 → 10 → 11 → 9`.

---

## 2. Repository & module layout (Clean Architecture + DDD)

```
src/
  main.ts                      # Express bootstrap, DI wiring, server start
  config/                      # env schema (zod), constants, feature flags
  shared/
    domain/                    # Money value object, Result, DomainError, base Aggregate/Event
    application/               # base UseCase, CQRS Command/Query bus, ScopeResolver
    infrastructure/
      prisma/                  # PrismaClient singleton + soft-delete extension
      redis/  opensearch/  storage/  events/(outbox+BullMQ)
    interface/
      http/                    # Express app, middleware (auth, ctx, error, idempotency)
  modules/
    catalog/
      domain/                  # Product, Variant, AttributeSet aggregates + invariants
      application/             # use-cases: CreateProduct, GetProduct, AssignAttribute...
      infrastructure/          # PrismaProductRepository, projections
      interface/               # admin + storefront controllers, zod DTOs, routes
      catalog.module.ts        # wires the above
    inventory/  order/  pricing/  customer/  ...  # same 4-layer shape each
  workers/                     # BullMQ processors (indexing, email, sweepers, partitions)
prisma/                        # schema/ + sql/ + seed.ts  (already exists)
test/                          # integration (testcontainers) + e2e
docker-compose.yml            # postgres, redis, opensearch, minio for local dev
```

**Dependency rule:** `interface → application → domain`; `infrastructure` implements
interfaces defined in `domain`/`application`. Domain imports nothing framework-y.

---

## 3. The per-context recipe (repeat for every bounded context)

For each context, in this order — this is the loop you'll run 10+ times:

1. **Schema** — add/confirm the Prisma models + raw SQL for this context.
2. **Review** — run the `schema-reviewer` subagent (static checklist).
3. **Verify** — run the `db-migration-verifier` subagent (live Postgres, smoke tests).
4. **Domain** — aggregates, value objects, invariants, domain events. Pure, unit-tested.
5. **Application** — use-cases (commands/queries), transaction boundaries, event emit.
6. **Infrastructure** — Prisma repositories, projections, port implementations.
7. **Interface** — controllers, zod DTOs, routes; wire into the module.
8. **Tests** — unit (domain) + integration (repo against testcontainers Postgres) +
   API (supertest). Include the *negative* invariant tests.
9. **Events** — publish via outbox; add/observe any consumer (search, analytics).

**Definition of done for a slice:** migration applied & verified, use-cases unit-tested,
one real API endpoint working against a live DB, integration test green in CI.

---

## 4. The full ordered sequence

### Stage 0 — Walking skeleton (do this first, ~1 sprint)
Goal: `docker compose up` → app boots → `GET /health` 200 → one migration applied →
CI green. No business features yet.
- [ ] `git init`; TypeScript, ESLint, Prettier, `tsconfig` (strict).
- [ ] `docker-compose.yml`: postgres:16, redis, opensearch, minio.
- [ ] Convert the Foundation from `db push` to a real migration:
      `prisma migrate dev --create-only`, then hand-edit to put extensions + `uuidv7()`
      at the top and append `prisma/sql/0001_foundation_raw.sql`. Commit it.
- [ ] Express app + `GET /health` (checks DB/Redis reachability).
- [ ] `shared/infrastructure/prisma` singleton + soft-delete client extension.
- [ ] Config via zod-validated env; structured logging (pino); error middleware
      (RFC 9457 problem+json); request-context middleware (store-view resolution stub).
- [ ] Test harness (vitest) + testcontainers; one integration test that migrates a
      throwaway PG and asserts a seeded row. CI runs it.

### Stage 1 — Foundation vertical slice (proves the architecture)
Context: **Catalog (read + minimal write)**.
- [ ] `ScopeResolver` in `shared/application` (STORE_VIEW→STORE→WEBSITE→GLOBAL). Unit-test it.
- [ ] Domain: `Product`, `AttributeSet` aggregates; `AttributeValue` with scope.
- [ ] Use-cases: `CreateProduct`, `AssignAttributeValue`, `GetProductForStoreView`
      (uses the raw scope-resolution query from plan/02 §5).
- [ ] Repo: `PrismaProductRepository`.
- [ ] API: `POST /admin/v1/products`, `GET /store/v1/products/:handle`.
- [ ] Tests through all layers. **This slice is the template for every later context.**

### Stage 2 — Financial core
- **Inventory (Phase 7)** — warehouse, `stock_item`, append-only `stock_movement`
  (partitioned), reservations. Implement the race-safe guarded UPDATE + reservation
  sweeper (BullMQ). This is the second ledger pattern; get it airtight.
- **Pricing (Phase 1 §7 / Phase 10 links)** — price lists, tiers, group/wholesale/B2B,
  resolver (group + store view + qty + date).
- **Order (Phase 8)** — cart → checkout saga → order with snapshots; tenders;
  fulfillment/refund/return. Depends on catalog + inventory + pricing.

### Stage 3 — Cross-cutting infrastructure (introduce as the core needs them)
- **Event outbox + BullMQ** — add when the first cross-context reaction is needed
  (e.g. `OrderPaid` → decrement stock / earn loyalty). Transactional outbox relay.
- **Redis caching** — PDP/scope-resolution cache with event-driven invalidation.
- **Auth** — admin OIDC + RBAC; storefront JWT + store-view context. Add before exposing
  admin write endpoints publicly.
- **Idempotency** — `idempotency_keys` on money-moving POSTs (checkout/payment).

### Stage 4 — Surfaces & search
- **Search (Phase 6)** — OpenSearch index + indexer worker fed by outbox events;
  storefront PLP/facets/search endpoints.
- **Storefront APIs (Phase 5)** — cart, checkout, account, wishlist, CMS reads.
- **Admin module (Phase 4)** — attribute-set builder, dynamic product editor, bulk jobs.

### Stage 5 — Engagement & money-adjacent
- **Stored value (Phase 10)** — gift cards, wallet, store credit (reuses ledger + tenders).
- **Loyalty & referral (Phase 11)** — points ledger, tiers, referral; shared RewardIssuer.

### Stage 6 — Production hardening (Phase 9)
- Read replicas + PgBouncer routing; partition-manager cron; analytics read model;
  observability (OTel, RED metrics, alerts on drift/DLQ/index lag); backups/PITR;
  CDN; per-client Docker/K8s deploy templates.

### Stage 7 — Admin UI (Phase 13)
- `apps/admin`, a Next.js app consuming `/admin/v1` — the first real client of the
  "API-first" principle (§1 point 7). Added the list/browse endpoints the backend
  never needed until a UI existed to call them (products, warehouses, price lists,
  orders, and the customer module's first-ever admin routes), then the screens
  themselves: products, inventory, pricing, orders, customers. Storefront UI and the
  remaining admin screens (loyalty/referral/wallet/gift-cards/CMS/wishlist/bulk
  import) are not yet built — see Phase 13 §6 for the full deferred list.

---

## 5. Where cross-cutting pieces slot in (don't build them too early)

| Piece | Introduce when | Not before, because |
|-------|----------------|--------------------|
| Outbox + BullMQ | first cross-context event (Stage 3) | nothing to react to yet |
| Redis cache | read latency matters / repeated scope resolution | premature; correctness first |
| OpenSearch | storefront browse/facets (Stage 4) | DB serves early admin reads fine |
| Auth/RBAC | before public write endpoints | slows early iteration |
| Partitioning cron | before prod data volume (Stage 6) | tables are small in dev |
| Read replicas | prod read scaling (Stage 6) | single DB fine in dev |

---

## 6. Testing & quality gates (every slice)

- **Unit** — domain invariants (pure, fast, no DB).
- **Integration** — repositories + raw SQL against a testcontainers Postgres; include
  the negative invariant tests (scope CHECK, NULLS NOT DISTINCT, guarded UPDATE races).
- **API/e2e** — supertest against the running app.
- **Subagents in the loop** — `schema-reviewer` (static) then `db-migration-verifier`
  (live) on every schema change. CI runs migrate + smoke + tests on a throwaway PG.

---

## 7. Do this next (the immediate first steps)

1. `git init` + commit the current `plan/` and `prisma/`.
2. Scaffold Stage 0 (Docker Compose + Express skeleton + real migration + CI + 1 test).
3. Build the Stage 1 Catalog vertical slice — it becomes the pattern for everything else.
4. Then Stage 2 Inventory.

> Recommended cadence: one context per iteration, each ending green in CI with a
> working endpoint. Resist going wide (many half-built contexts); go deep (one context
> done) so integration risk stays near zero.

# Phase 2 — Prisma Schema Strategy & Migrations

> Goal: model the Phase 1 schema in Prisma **without letting the ORM dictate the
> database**. Prisma owns the boring 80%; raw SQL owns the 20% Prisma can't express
> (partitioning, partial/GIN/BRIN indexes, LTREE, CHECK constraints, triggers).

---

## 1. Prisma's known limits vs. our design (and the resolution)

| Design need | Prisma native? | Resolution |
|-------------|----------------|------------|
| Partial indexes (`WHERE deleted_at IS NULL`) | ⚠️ partial | Declare in schema where supported; else raw SQL in migration |
| GIN / BRIN / LTREE / `jsonb_path_ops` | ✗ | Raw `CREATE INDEX` in migration files |
| Table partitioning (orders, movements, audit) | ✗ | Raw SQL: create partitioned parent + a partition-manager job |
| CHECK constraints (scope consistency, rating 1–5) | ✗ (pre-`@@check` era) | Raw `ALTER TABLE ADD CONSTRAINT` |
| DB triggers (audit_log, updated_at) | ✗ | Raw SQL functions + triggers |
| CITEXT / LTREE / composite types | ⚠️ `Unsupported()` | `Unsupported("citext")` / `Unsupported("ltree")` + raw for logic |
| Multi-column typed EAV hot reads | works but slow via ORM | `$queryRaw` typed queries on the hot path |

**Rule:** Prisma migrations are the spine; every migration may be *hand-edited* to
append raw SQL. We use `prisma migrate dev` to scaffold, then commit the edited SQL.

---

## 2. Schema organization

Prisma supports multi-file schemas (`prisma/schema/*.prisma`). One file per bounded
context, mirroring Phase 1:

```
prisma/
  schema/
    _base.prisma          # datasource, generator, enums, shared
    store.prisma          # website/store/store_view/language/currency/theme
    catalog.prisma        # product/variant/attribute*/category/media
    metafield.prisma
    customer.prisma
    pricing.prisma
    inventory.prisma
    order.prisma
    promotion.prisma
    tax.prisma
    shipping.prisma
    payment.prisma
    cms.prisma
    search.prisma         # synonyms/boosts config only (index lives in OpenSearch)
    seo.prisma
    system.prisma         # audit_log, outbox, idempotency_keys, jobs
  migrations/
```

`generator client { previewFeatures = ["multiSchema", "postgresqlExtensions"] }`
and enable `citext`, `ltree`, `pg_trgm`, `btree_gin` extensions.

---

## 3. Conventions encoded in every model

```prisma
model Product {
  id             BigInt   @id @default(autoincrement())
  publicId       String   @unique @default(dbgenerated("uuidv7()")) @map("public_id") @db.Uuid
  sku            String   @unique @db.Citext            // Unsupported handled via citext ext
  type           ProductType
  attributeSetId BigInt   @map("attribute_set_id")
  status         ProductStatus @default(DRAFT)
  // ... typed core columns ...
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy      BigInt?  @map("created_by")
  updatedBy      BigInt?  @map("updated_by")
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz

  attributeSet   AttributeSet @relation(fields: [attributeSetId], references: [id])
  values         ProductAttributeValue[]
  variants       ProductVariant[]

  @@index([status, deletedAt])
  @@map("product")
}
```

- `snake_case` DB names via `@map`/`@@map`; `camelCase` in TS.
- `BigInt` PKs; `Uuid` public ids (a `uuidv7()` SQL function shipped in migration 0).
- All timestamps `@db.Timestamptz`.
- Enums declared once in `_base.prisma` (matches Phase 1 enums exactly).

---

## 4. Soft delete as a Prisma Client Extension

```ts
export const softDelete = Prisma.defineExtension({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      // findFirst/findUnique similar; delete → update{deletedAt: now}
    },
  },
});
```
- One extension, applied to the shared `PrismaClient` singleton.
- `deleteMany`/`delete` are remapped to set `deletedAt`. A separate
  `prisma.$executeRaw` "hard delete" path exists only for the GDPR purge job.
- Models that must bypass (audit_log, outbox, stock_movement — append-only, never
  soft-deleted) are excluded by name.

---

## 5. The EAV / hot-read escape hatch

Reading a full PDP via Prisma relations would be many round-trips. Instead, a typed
raw query hydrates a product's resolved attributes in one shot:

```ts
const rows = await prisma.$queryRaw<ResolvedAttr[]>`
  SELECT DISTINCT ON (v.attribute_id)
         v.attribute_id, a.code, a.data_type,
         v.value_text, v.value_int, v.value_decimal, v.value_datetime, v.value_json
  FROM product_attribute_value v
  JOIN attribute a ON a.id = v.attribute_id
  WHERE v.product_id = ${productId}
    AND v.scope_rank <= ${scopeRankFor(storeViewId)}   -- resolver ordering
  ORDER BY v.attribute_id, v.scope_rank DESC;`;
```
`scope_rank` is a generated column (`GLOBAL=0..STORE_VIEW=3`) so scope resolution is
a single `DISTINCT ON` — no N-level fallback in app code. Added via raw migration.

> This is the concrete payoff of the master-plan note "embrace raw SQL where Prisma
> is weak." Prisma stays for writes and simple reads; raw for the catalog hot path.

---

## 6. Migration strategy

### 6.1 Environments & flow
- **Dev:** `prisma migrate dev` scaffolds → developer appends raw SQL blocks
  (indexes, partitions, triggers, checks) → commit.
- **CI:** `prisma migrate diff` guards drift; `prisma migrate deploy` on a shadow DB
  + full test suite before merge.
- **Prod:** `prisma migrate deploy` only. Never `migrate dev` in prod.

### 6.2 Expand → Migrate → Contract (zero-downtime)
For any breaking change (rename, type change, NOT NULL):
1. **Expand** — add new nullable column/table; backfill via batched job.
2. **Migrate** — deploy code writing to both; read from new.
3. **Contract** — drop old column in a later release.
Never a single destructive migration on a live 50M-row table.

### 6.3 Big-table migrations
- Adding an index on `orders`/`stock_movements` → `CREATE INDEX CONCURRENTLY`
  (hand-written; Prisma can't emit it) run *outside* the transactional migration.
- Backfills batched (`LIMIT 10k` loops) via a BullMQ maintenance job, not in-migration.

### 6.4 Partitioning bootstrap
Migration `000X_partitioning.sql` (raw):
- Convert `orders`, `order_line`, `stock_movement`, `audit_log`, `analytics_event`,
  `cart` to `PARTITION BY RANGE (created_at)`.
- Ship a `partition_manager` BullMQ cron that pre-creates next month's partitions and
  detaches/archives partitions past retention.

### 6.5 Seeding
`prisma/seed.ts` (idempotent, upserts):
- Default `website`/`store`/`store_view`, base `currency`/`language`, default
  `customer_group`, `tax_class`, root `category`, one demo `attribute_set`
  (Electronics/Apparel/Furniture as fixtures), admin user.
- Reference data (currencies, countries, languages) from static JSON.

---

## 7. Trade-offs

- **Raw-SQL-in-migrations means Prisma isn't the whole truth.** Accepted: we document
  every raw block and keep a `db/manual/` folder mirroring them for review. The
  alternative (bending the schema to Prisma's expressiveness) would cripple the
  catalog and partitioning — non-negotiable at this scale.
- **Multi-file schema + multiSchema is a preview feature.** Low risk, widely used;
  pinned Prisma version in CI.
- **BigInt in JS.** Serialize to string at the API boundary (public_id is the real
  external id anyway); a global JSON serializer handles it.

## 7b. Lessons from the concrete implementation (validated on PostgreSQL 16)

The Foundation slice (Store + Catalog core) is implemented under `prisma/` and was
run end-to-end against Postgres 16. Two correctness fixes surfaced that every model
must honor:

1. **`updated_at` needs a DB default, not just `@updatedAt`.** Prisma's `@updatedAt`
   sets the value in the *client*; a raw-SQL insert (which this design explicitly
   supports for hot paths and bulk loads) leaves it NULL and violates `NOT NULL`.
   Fix: `updatedAt DateTime @default(now()) @updatedAt`. Belt-and-suspenders: a
   `set_updated_at` BEFORE UPDATE trigger keeps it authoritative for raw writes too.
2. **Scope uniqueness must be `NULLS NOT DISTINCT`.** Postgres treats NULLs as
   distinct by default, so two GLOBAL rows (all scope FKs NULL) both insert and the
   `@@unique` does nothing. Fix: recreate the index with `NULLS NOT DISTINCT` in raw
   SQL. Use `@@unique(..., map: "name")` (NOT `name:`) so the DB index name is
   predictable and the raw block can drop/replace it — `name:` only sets the Prisma
   Client field name, not the DB object.

Also confirmed working: `dbgenerated("uuidv7()")` defaults (a plpgsql UUIDv7 that
must be created before tables), the `scope_rank` GENERATED column for single-pass
scope resolution, scope-consistency CHECKs, single-default partial unique indexes,
and LTREE `path` + closure-table maintenance via triggers. See `prisma/README.md`
and `prisma/sql/_smoke_test.sql`.

## 8. Platform comparison

| Concern | Magento | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|---------|--------|--------|---------------|-----------------|
| Schema tooling | Declarative XML + setup scripts | Django migrations | MikroORM/TypeORM migrations | Managed (no self-migrate) | **Prisma + raw SQL escape hatch** |
| Zero-downtime | Manual | Django-managed | Manual | N/A (SaaS) | **Expand/Migrate/Contract codified** |
| Partitioning | Rare | ✗ | ✗ | Managed | **First-class (raw migrations + manager job)** |

*Next: `plan/03-rest-api-design.md`.*

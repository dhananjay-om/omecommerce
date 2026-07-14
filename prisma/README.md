# Prisma — Foundation (Store + Catalog core)

Concrete implementation of `plan/01-domain-model-and-erd.md` (§1–§5) and
`plan/02-prisma-schema-and-migrations.md`. **Validated end-to-end against
PostgreSQL 16** — schema, constraints, generated columns, triggers, and the LTREE
closure all run and enforce their invariants (see `sql/_smoke_test.sql`).

## Layout

```
prisma/
  schema/
    _base.prisma      datasource, generator, extensions, all enums
    store.prisma      website / store / store_view / language / currency / theme
    catalog.prisma    attribute sets/attributes/options, product/variant, category, media
    metafield.prisma  Shopify-style metafields (namespaced, scoped, versioned)
  sql/
    0001_foundation_raw.sql   raw SQL Prisma can't express (see below)
    _smoke_test.sql           functional invariant tests (not a migration)
  seed.ts             idempotent seed
```

## What lives in raw SQL (and why)

Prisma models the boring 80%; `sql/0001_foundation_raw.sql` holds the 20% the ORM
can't express. In a real deploy, its contents are pasted into (or run right after)
the generated Prisma migration — see the workflow at the top of that file.

| Block | Why raw |
|-------|---------|
| `uuidv7()` function | referenced by `@default(dbgenerated("uuidv7()"))`; **must exist before tables** |
| `set_updated_at` trigger | DB-authoritative `updated_at` for raw-SQL writers |
| deferred/cyclic FKs (website↔store↔category↔store_view) | break creation cycles; kept scalar in Prisma |
| scope FKs (website/store/store_view/language on value tables) | avoids dozens of noisy back-relations on the scope tables |
| scope-consistency CHECKs | replaces Magento's `store_id=0` convention with real integrity |
| `scope_rank` GENERATED column | single-pass scope resolution (`DISTINCT ON … ORDER BY scope_rank DESC`) |
| `NULLS NOT DISTINCT` unique indexes | Prisma's `@@unique` treats NULLs as distinct → duplicate GLOBAL rows slip through |
| single-default partial unique indexes | exactly one default website / attribute set |
| layered-nav indexes (partial b-tree + GIN) | fast faceting on the EAV value table |
| LTREE path + closure triggers, `category_reparent()` | unlimited category hierarchy with fast subtree/breadcrumb |

## Local workflow

```bash
cp .env.example .env                      # point DATABASE_URL at your Postgres
# 1. pre-reqs (extensions + uuidv7) — in prod these go at the TOP of the first migration:
psql "$DATABASE_URL" -f - <<'SQL'
  CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS ltree;
  CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gin;
  -- (paste the uuidv7() function from sql/0001_foundation_raw.sql §1)
SQL
# 2. sync schema
npx prisma db push --schema prisma/schema           # dev; use migrate deploy in prod
# 3. apply raw blocks
psql "$DATABASE_URL" -f prisma/sql/0001_foundation_raw.sql
# 4. seed + verify
npm run db:seed
psql "$DATABASE_URL" -f prisma/sql/_smoke_test.sql
```

> **Production**: use `prisma migrate dev --create-only` to scaffold, then hand-edit the
> generated `migration.sql` to (a) put extensions + `uuidv7()` at the very top and
> (b) append the rest of `0001_foundation_raw.sql`. Then `prisma migrate deploy`.
> This is the expand/migrate/contract flow from plan/02 §6.

## Two correctness fixes surfaced by end-to-end testing

Recorded here and in plan/02 so they aren't re-hit:

1. **`updated_at` needs a DB default.** Prisma's `@updatedAt` is client-side only; raw
   inserts hit `NOT NULL`. Fix: `@default(now()) @updatedAt`.
2. **Scope uniqueness needs `NULLS NOT DISTINCT`.** Otherwise two GLOBAL rows
   (all scope FKs NULL) are considered distinct and both insert. Fix applied in raw SQL;
   `@@unique(map:)` (not `name:`) controls the DB index name so it can be replaced.

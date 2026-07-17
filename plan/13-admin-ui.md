# Phase 13 — Admin UI (as-built)

> Written after the fact, unlike Phases 1–12 (which were written before their code).
> Phases 0–12 assumed the admin UI and storefront would exist someday as separate
> clients of the versioned API (Phase 1 §7 "API-first") but never designed them —
> zero frontend code existed until this phase. This document records what was
> actually decided and built, so it isn't lost to commit-message archaeology.

---

## 1. Decisions locked in

- **Stack**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui (on
  `@base-ui/react` primitives, not Radix — see §5).
- **Location**: `apps/admin/` in this same repo, as its own standalone Next.js
  project (own `package.json`/lockfile/`node_modules`), not a formal npm/pnpm
  workspace. It talks to the Express API purely over HTTP, the same contract
  Postman/integration tests already exercise.
- **Auth pattern**: BFF (backend-for-frontend). Login posts to a Next.js Server
  Action, which calls `POST /admin/v1/auth/login` and stores the resulting JWT in an
  **httpOnly cookie** (`ome_admin_token`) — never exposed to client-side JS. Every
  Server Component read and Server Action write attaches `Authorization: Bearer
  <token>` server-side. The real session check lives in `lib/api-client.ts`'s
  `requireSession()`, called on every data fetch — not just once in a shared layout —
  because Next.js layouts don't re-render on client-side navigation (confirmed
  against Next's own docs before writing any auth code).
- **Pagination**: simple offset (`page`/`pageSize`), matching the actual existing
  precedent (search module) rather than the cursor-based envelope Phase 3 describes
  aspirationally. Correct at this scale (admin/dev usage).
- **Scope**: admin UI only, MVP. Storefront UI, and admin screens for
  loyalty/referral/wallet/gift-cards/CMS/wishlist/bulk-import, are explicitly
  deferred — real backend features with zero UI today, each its own future phase.

## 2. The gap this phase found and fixed

Scoping this surfaced the same kind of "must fix first" blocker Stage 5b hit with
`Order.customerId`: the backend had almost no admin **list/browse** endpoints. Every
prior stage built targeted reads for specific write flows, never a general "browse
everything" surface, because nothing needed one until now. Confirmed and fixed:

- No `GET /admin/v1/products` (list) or admin-shaped product detail — the only
  product GET was a storefront PDP route needing a `storeViewId`.
- No endpoint anywhere returned a variant's `publicId` (needed by inventory/pricing
  actions that address stock/price by variant, not by product).
- No `GET /admin/v1/warehouses` or `GET /admin/v1/price-lists` list endpoints.
- No `GET /admin/v1/orders` list (only get-by-id).
- **No admin routes at all** in the customer module — `customer.module.ts` only
  ever exported a `store` router.

None of this needed a migration — read-only new use-cases over data that already
existed, following the exact per-context recipe every prior stage used (domain port
→ use-case → Prisma repository method → HTTP route).

## 3. Phases shipped

| Phase | Backend | Frontend |
|---|---|---|
| A | `GET /admin/v1/products/:publicId/variants` | — |
| B | — | Next.js scaffold, BFF auth, dashboard shell |
| C | `GET /products` (list), `GET /products/:publicId` (detail), `GET /attribute-sets` | Products list/create/detail |
| D | `GET /warehouses`, `GET /inventory/warehouses/:code/stock`, `GET /price-lists` | Inventory + Pricing (create warehouse, adjust stock, create price list, set price) |
| E | `GET /orders` (paginated, filterable) | Orders list/detail + fulfill/refund/cancel dialogs |
| F | Customer module's first-ever admin router: `GET /customers`, `GET /customers/:publicId` | Customers list/detail |
| G | `PATCH /products/:publicId` (core-field update), `GET /attribute-sets/:id` (detail: groups + attributes + options) | Real product Edit page (previously create-only); `weight` wired end-to-end |
| H | `PUT /products/:publicId/attributes/bulk` (atomic, one outbox event) | Dynamic per-data-type attribute-value inputs on create/edit forms |
| I | `sortBy`/`sortDir`/`type`/`attributeSetId` filters + quantity/salable-quantity columns on `GET /products` | Filters panel, sortable headers, bulk Activate/Deactivate |
| L | `GET /attributes` (new; everything else already existed unused) | Attribute Sets + Attributes builder UI: create sets/groups/attributes, assign an attribute to a group |
| K | `GET/POST/PATCH/DELETE /categories`, `PUT /categories/:id/parent`, `PUT /products/:id/categories` | Category tree page (create/rename/delete), category picker on the product form |
| J | `POST /media/uploads`, `POST /media`, `POST/DELETE /products/:id/media`, thumbnail batch-lookup on `GET /products` | Direct-to-storage image upload + gallery on product edit, grid thumbnail column |

Phases G–I were a second round, prompted by the user referencing Magento's admin
Products grid/edit-form UI as a target — see §7. Phases L, K, J were a third round,
closing the three gaps that round's own retrospective (§6, prior revision) had
explicitly flagged and deferred — see §8.

Each phase: backend endpoints tested with integration tests against a throwaway
Postgres (same rigor as every backend stage), frontend typechecked/built/linted, then
exercised in a real headless-Chromium browser pass (login → the actual CRUD flow →
confirm the result) before being committed — one commit per phase, matching the
existing one-commit-per-stage convention.

A regression slipped through here worth noting: adding `isDefault` to the
attribute-set create response in Phase C broke `attribute-set-api.test.ts`'s exact
`toEqual` assertion, uncaught until the full integration suite was run at the end of
Phase F. Lesson applied: run the *full* suite before closing out a phase, not just
the files the phase touched.

## 4. Visual design pass

Two follow-up passes, both user-directed against a reference:

1. **Brand theme** — sampled the company logo's red-orange (`#ee3514`) directly from
   the image (pixel color analysis, not eyeballing) and wired it through as
   `--primary` in `globals.css` (OKLCH), plus `--success`/`--warning` tokens and
   matching `Badge` variants so status pills are semantically color-coded (green =
   active/paid/fulfilled, amber = pending/draft/processing, red = cancelled/disabled)
   instead of a flat black/gray binary.
2. **Reference-driven SaaS redesign** — given screenshots of a comparable SaaS admin
   product, rebuilt the shell to match: a permanently-dark sidebar (independent of
   any light/dark toggle, since this app doesn't have one) with grouped nav sections
   and a cream/orange active pill, a persistent top header (breadcrumb + avatar +
   sign-out), a split-screen login page, and a new `/dashboard` landing page with KPI
   cards fed by existing list endpoints' `total` fields (no new backend needed).
   Colors were re-sampled pixel-by-pixel from the reference screenshot rather than
   approximated.

A real bug was caught and fixed during this pass, not just cosmetic drift:
`globals.css`'s `--font-sans` theme token was self-referential
(`--font-sans: var(--font-sans)`), so it never resolved to the Geist Sans font
`next/font` actually injects (`--font-geist-sans`) — every heading in the app had
been silently falling back to the browser's default serif font since Phase B.

## 5. Notable technical findings (for whoever touches `apps/admin` next)

- **Next.js 16 breaking changes**: `cookies()` is async; `middleware.ts` is renamed
  `proxy.ts`; `params`/`searchParams` in pages are `Promise<...>`.
- **shadcn/ui here is built on `@base-ui/react`, not Radix.** Meaningfully different
  in places: `Select.Value` does not infer a label from `Select.Item` children like
  Radix's does — it renders the raw value unless given a children render-function or
  an `items` map on `Select.Root`. `Button`/`Dialog.Trigger` don't support `asChild`;
  use the `render={<Component />}` prop instead, or apply `buttonVariants()` directly
  to the target element's `className`.
- React's `no-unused-vars`/`set-state-in-effect` lint rule flags the common
  "close a dialog when a Server Action's `useActionState` result changes" pattern if
  done via `useEffect`. Fixed everywhere by comparing the state object reference
  during render (React's documented "adjusting state when a prop changes" pattern)
  instead of an effect.

## 6. Deliberately out of scope

- The storefront UI entirely — its own future plan.
- Admin screens for Loyalty, Referral, Wallet, Gift Cards, CMS, Wishlist, bulk
  product import, search/facet configuration.
- Attribute-set builder UI, product images, and categories were all real gaps
  through the end of Phase I — closed in Phases L, K, J respectively (§8).
- `MediaTransform` renditions (thumb/medium/zoom) — Phase J serves the original
  upload at all sizes; real resize/thumbnail generation needs `sharp` plus a
  background job (matching the existing BullMQ worker pattern), not attempted.
- `CategoryRule` (Magento's dynamic/rule-based categories) — Phase K's category
  tree is manual assignment only.
- Drag-and-drop reordering for either the category tree or the product image
  gallery — Phase K/J both got simple, non-drag interactions (a parent picker,
  up/down-free position via insertion order) instead.
- Fine-grained RBAC-aware UI (the backend has real permissions like
  `catalog:manage`/`orders:refund`; this UI doesn't branch on them yet).
- A shared types package between `apps/admin` and the backend.
- Cursor-based pagination.
- A real `/admin/v1/auth/me` endpoint — the top header's avatar shows a generic
  "Admin" label rather than the logged-in admin's actual email/name, since the JWT
  doesn't carry it and no profile endpoint exists yet.
- Configurable-product variant-matrix generation (Magento's "Configurations"
  wizard) — real feature, big scope, not attempted.

## 7. Phases G–I: product edit, dynamic attributes, richer grid

Prompted by the user pointing at Magento's admin Products grid and product-edit
form as a reference and asking for the gap to be closed. Full detail in the
Phase G/H/I commit messages; the notable findings:

- **`SELECT`-type attribute values are stored by the `AttributeOption` row's own
  numeric `id`, not its `value` string** (`toColumns()`'s `REF_TYPES` set writes
  `value_int`). The attribute-set-detail endpoint didn't expose the option `id` at
  all until Phase H added it — without it there was no way for a dynamic form to
  submit a valid SELECT value.
- **`AttributeDataType` has more members than an earlier audit found**: `JSON`,
  `RICHTEXT`, and six `REF_*` reference types (`REF_PRODUCT`/`REF_CATEGORY`/
  `REF_BRAND`/`REF_CMS`/`REF_COLLECTION`/`REF_CUSTOMER`) were missing from the
  frontend's type union, caught by a real TypeScript error once the dynamic
  attribute-input component tried to exhaustively branch on data type. `REF_*`/
  `JSON`/`IMAGE`/`FILE` render nothing in the product form (need a reference-picker
  or upload UI — real, separate future work), but are at least correctly typed now.
- **Turning a Server Component into a Client Component (for bulk row-select)
  surfaced a genuine hydration bug that had been latent the whole time**:
  `toLocaleDateString()` with no explicit locale formats differently on the Node
  server than in a browser. As a pure Server Component the date was only ever
  formatted once (server-side, baked into static HTML); once the same code became
  part of a hydrating Client Component, the client re-executed it and diverged.
  Fixed by pinning an explicit locale — worth checking for on any other Server →
  Client Component conversion in this codebase.
- The bulk attribute-write endpoint (`AssignAttributeValues`, plural) exists
  alongside the original single-attribute one specifically because a form save with
  a dozen+ attributes as N sequential PUTs would mean N outbox events for one
  logical change; the bulk-import worker still uses the singular per-row version,
  where that's the correct semantics.

## 8. Phases L, K, J: attribute builder, categories, product images

Requested together by the user immediately after G–I shipped, closing the three
gaps that round's retrospective had explicitly flagged and deferred. Built in
priority order — smallest/lowest-risk first: L (attribute builder — almost pure
frontend, backend endpoints already existed), then K (categories), then J
(product images — the only one needing genuinely new infrastructure).

**L** — the entire backend already existed and worked (proven by this project's
own integration tests) except a list-all-attributes endpoint; the phase was
overwhelmingly "wire a screen to routes nobody had built a UI for yet." Closes
the loop with Phase H end-to-end: create an attribute (with inline options),
create a set, create a group, assign the attribute — it then renders as a typed
input on the product form.

**K** — re-assessed as meaningfully lower-risk than the original Phase G–I
retrospective feared. The Postgres `ltree` path column and the transitive
closure table are **not** hand-maintained by the application layer; existing
triggers (`category_before_insert`/`category_after_insert`) and a
`category_reparent(child, new_parent)` stored procedure
(`prisma/sql/0001_foundation_raw.sql` §11–12, present since Stage 1) already do
it. Prisma's typed client works normally for ordinary CRUD (it just never
selects the `Unsupported("ltree")` column); raw SQL is only needed for the one
call to `category_reparent()`. That procedure doesn't itself guard against
cycles (moving a category under its own descendant), so the application layer
added that check — an in-memory walk over the flat category list, which is
simpler and just as correct as a recursive SQL query at this table's size.
Delete is guarded (rejects a category with children or assigned products);
cascading soft-delete is separate future work.

**J** — the only phase needing new infrastructure, and the one carrying the
most genuinely new risk:
- **A `minio` service was already defined in `docker-compose.yml` but never
  part of the actually-running dev stack** (`ome-pg-dev`/`ome-redis-dev`/
  `ome-os-dev`, all started via standalone `docker run` with nonstandard ports,
  not `docker compose up`). Starting it revealed **an unrelated project's own
  `minio` container already occupying the default 9000/9001** on this shared
  dev machine — had to pick different host ports (59000/59001) for
  `ome-minio-dev`, matching the existing nonstandard-port convention the other
  three containers already used for the same underlying reason (this machine
  runs more than one project's dev stack side by side).
- Chose a **direct-to-storage upload flow** (browser PUTs bytes straight to
  MinIO/S3 via a presigned URL) over proxying uploads through the Express
  server — avoids adding multer/busboy and keeps large file bytes off the API
  process. `@aws-sdk/client-s3` was used rather than a MinIO-specific SDK,
  since it works against any S3-compatible endpoint (including real AWS S3 in
  production) with `forcePathStyle: true` for MinIO compatibility.
- Presigned GET URLs are generated per-request at read time, not stored — so no
  bucket ACL or public-read config is needed, and access naturally expires.
- The products grid's thumbnail column needed a batched lookup (one raw SQL
  `DISTINCT ON` query per page of results, mirroring the existing
  `sumStockByProduct` pattern in `prisma-product.repository.ts`) rather than
  N queries for N rows.
- A second instance of the established Base-UI "uncontrolled `defaultValue`"
  class of bug (see §5/§7) was caught and fixed during Phase K verification: the
  category rename dialog's `Input` needed a `key` tied to the category's name so
  it remounts instead of silently changing its uncontrolled value after a
  `router.refresh()`.

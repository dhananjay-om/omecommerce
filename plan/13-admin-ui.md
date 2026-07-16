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
- A full attribute-set *builder* UI (groups, per-type input widgets) — the product
  detail page shows attributes read-only.
- Fine-grained RBAC-aware UI (the backend has real permissions like
  `catalog:manage`/`orders:refund`; this UI doesn't branch on them yet).
- A shared types package between `apps/admin` and the backend.
- Cursor-based pagination.
- A real `/admin/v1/auth/me` endpoint — the top header's avatar shows a generic
  "Admin" label rather than the logged-in admin's actual email/name, since the JWT
  doesn't carry it and no profile endpoint exists yet.

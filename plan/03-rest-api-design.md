# Phase 3 — REST API Design (API-First)

> The admin UI and storefront are **clients of the same versioned API**. This phase
> defines the contract, conventions, auth, and the Clean-Architecture request path.
> (Admin-specific endpoints → Phase 4; storefront-specific → Phase 5.)

---

## 1. Surfaces

Three logical API surfaces, one codebase:

| Surface | Base path | Audience | Auth |
|---------|-----------|----------|------|
| **Admin API** | `/admin/v1/**` | Merchant staff, back-office | OAuth2/OIDC + RBAC, session or PAT |
| **Storefront API** | `/store/v1/**` | Buyers, headless frontends | Public key + optional customer JWT; store-view scoped |
| **Webhook/Integration API** | `/hooks/v1/**` | 3rd-party systems | HMAC-signed, API keys |

> REST is the default (broad tooling, cacheable). A **GraphQL gateway** over the same
> application layer is a Phase-5 option for storefront (Saleor/Shopify-style); the
> domain/application layers are transport-agnostic so both can coexist.

---

## 2. Request path (Clean Architecture)

```
HTTP (Express router)
  → Interface layer:   controller — validate (zod), authn/authz, map DTO
  → Application layer:  use-case / command|query handler (orchestration, TX boundary)
  → Domain layer:       aggregates, invariants, domain events  (no framework here)
  → Infrastructure:     Prisma repos, Redis, OpenSearch, S3, BullMQ producers
  → emits domain events → outbox (same TX) → BullMQ
```
- **Commands** (writes) and **Queries** (reads) split at the application layer
  (**CQRS where beneficial**): queries may bypass the domain and hit read models /
  OpenSearch / cached projections directly; commands always go through aggregates.
- Controllers are thin; no business logic. Validation via **zod** schemas that also
  generate the OpenAPI spec.

---

## 3. Conventions

- **Resource-oriented, plural nouns:** `/admin/v1/products`, `/products/{id}/variants`.
- **IDs in URLs are `public_id` (UUID)** — never the internal BigInt.
- **Verbs for actions that aren't CRUD:** `POST /orders/{id}/actions/refund`,
  `POST /carts/{id}/actions/apply-coupon`. Keeps side-effectful transitions explicit.
- **Filtering/sorting/pagination:**
  `GET /products?filter[status]=active&filter[attribute_set]=electronics&sort=-created_at&page[size]=50&cursor=...`
  - **Cursor pagination** for large/append lists (orders, products) — stable at scale.
  - Offset pagination only for small bounded admin lists.
- **Sparse fieldsets / expansion:** `?fields=sku,name&expand=variants,media` to control
  payload (crucial for a 5M-catalog admin).
- **Consistent envelope:**
  ```json
  { "data": {…|[…]}, "meta": { "page": {…}, "total": 1234 }, "links": {…} }
  ```
- **Errors (RFC 9457 Problem Details):**
  ```json
  { "type": "https://errors.ome/validation", "title": "Validation failed",
    "status": 422, "errors": [{ "path": "sku", "message": "already exists" }],
    "traceId": "…" }
  ```

---

## 4. Versioning & evolution

- **URL major version** (`/v1`) — coarse, cache/proxy friendly.
- **Additive changes are non-breaking** and ship without a version bump; breaking
  changes → `/v2` running in parallel, old version deprecated with `Sunset` header.
- **OpenAPI 3.1 is the source of truth**, generated from zod + code. SDKs and Postman
  collections generated from it. Contract tests assert code matches spec.

---

## 5. Auth & multi-store context

- **Admin:** OIDC login → short-lived access JWT + refresh; **RBAC** (`role`,
  `permission`, `role_permission`, `user_role`) with permissions scoped to
  website/store (a staff user may manage only certain stores).
- **Storefront:** every request carries a **store-view context** (via API key,
  subdomain, or `X-Store-View` header) → sets language/currency/price-list/tax/
  visibility for the whole request. Customer JWT optional (guest browsing allowed).
- **Idempotency:** `Idempotency-Key` header required on all storefront POSTs that
  create money-moving resources (checkout, payment) → `idempotency_keys` table.
- **Rate limiting:** Redis token-bucket per API key / IP; stricter on auth & checkout.

---

## 6. Cross-cutting API concerns

| Concern | Mechanism |
|---------|-----------|
| Caching | `ETag`/`Cache-Control` on cacheable GETs; Redis cache-aside behind reads; CDN for anonymous storefront GETs |
| Concurrency | `If-Match`/ETag → optimistic `version` check on aggregates |
| Tracing | W3C `traceparent`; every response returns `traceId` |
| Validation | zod at the edge; domain re-checks invariants |
| Bulk ops | `POST /admin/v1/products/bulk` → async job, returns `202` + job id; poll `/jobs/{id}` |
| Webhooks out | `webhook_subscription` + signed delivery via BullMQ with retries/backoff |
| Localization | `Accept-Language` + store-view; responses localized server-side |

---

## 7. Representative endpoint map (detail in Phases 4/5)

```
Admin:    /admin/v1/{products,variants,attribute-sets,attributes,categories,
                     price-lists,inventory,warehouses,orders,customers,customer-groups,
                     discounts,cms-pages,blocks,reviews,media,url-rewrites,settings,
                     stores,store-views,taxes,shipping,payments,webhooks,jobs}
Storefront:/store/v1/{catalog,products,collections,search,cart,checkout,customers,
                     me,wishlist,reviews,cms,content}
Webhooks: /hooks/v1/{payment-gateway callbacks, carrier callbacks}
```

---

## 8. Trade-offs

- **REST-first vs GraphQL-first.** REST wins on caching, ubiquity, and admin CRUD
  ergonomics; GraphQL shines for storefront over-/under-fetching. We ship REST as the
  contract and offer GraphQL as a thin storefront gateway — best of both, one domain.
- **Cursor pagination** costs some client convenience (no "jump to page 500") but is
  the only correct choice on 5M/50M tables.
- **Public UUID in URLs** adds a lookup vs. exposing BigInt, but prevents enumeration
  and decouples external contract from internal keys.

## 9. Platform comparison

| Concern | Shopify | Magento 2 | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|---------|-----------|--------|--------|---------------|-----------------|
| Primary API | REST + GraphQL | REST + GraphQL (heavy) | GraphQL-only | REST | REST + GraphQL | **REST-first + optional GraphQL storefront gateway** |
| Versioning | Date-based | URL | Schema evolution | URL | URL | **URL major + additive; OpenAPI source of truth** |
| Admin/store split | Separate APIs | Same stack | Separate | Separate | Separate | **One domain, three surfaces** |
| Idempotency | ✓ | ✗ | Partial | Partial | ✓ | **Required on money-moving POSTs** |

*Next: `plan/04-admin-module.md`.*

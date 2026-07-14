# Phase 5 — Storefront APIs (Buyer-Facing)

> Headless, high-read, cache-heavy. Every request is **store-view scoped** (language,
> currency, price list, tax jurisdiction, catalog visibility). Reads hit read models /
> OpenSearch / Redis; writes (cart, checkout) go through the domain.

---

## 1. Request context resolution

Every `/store/v1` request resolves a **StorefrontContext** early (middleware):
```
store_view  ← subdomain | X-Store-View header | API key mapping
language    ← store_view.language (override via Accept-Language if allowed)
currency    ← store_view.currency
customer    ← optional JWT → customer + customer_group (else "guest" group)
price_list  ← resolved from group + store view + date
tax_context ← jurisdiction from store view + shipping address (at checkout)
visibility  ← product_store_view + category_store_view filters
```
This context is threaded into every query so pricing, visibility, and content are
correct without per-endpoint plumbing.

---

## 2. Endpoint groups

### 2.1 Catalog / browse (read-optimized, CDN-cacheable when anonymous)
```
GET /store/v1/collections/{handle}                 category landing + facets
GET /store/v1/collections/{handle}/products        PLP (paginated, filterable)
GET /store/v1/products/{handle}                     PDP (resolved attrs, media, price, stock)
GET /store/v1/products/{handle}/variants            variant matrix + availability
GET /store/v1/products/{id}/related                 related/cross-sell/up-sell
```
- **PLP & facets are served by OpenSearch** (Phase 6), not the DB — fast layered
  navigation with counts.
- **PDP** hydrates via the raw scope-resolved attribute query (Phase 2 §5) + cached in
  Redis keyed by `(product, store_view, price_list)`; media URLs point at the CDN.
- Prices reflect resolved price list (group/tier/special/scheduled); stock reflects
  store/warehouse availability projection.

### 2.2 Search
```
GET /store/v1/search?q=...&filter[...]&sort=...     full-text + facets + autocomplete
GET /store/v1/search/suggest?q=...                  typeahead
```
Backed entirely by OpenSearch (synonyms, stop words, boosts, "AI search ready" vector
field). Detail in Phase 6.

### 2.3 Cart (write path, guest + customer)
```
POST   /store/v1/carts                              create (guest token or customer)
GET    /store/v1/carts/{id}
POST   /store/v1/carts/{id}/items                   add
PATCH  /store/v1/carts/{id}/items/{lineId}          qty change
DELETE /store/v1/carts/{id}/items/{lineId}
POST   /store/v1/carts/{id}/actions/apply-coupon
POST   /store/v1/carts/{id}/actions/merge           merge guest→customer on login
```
- Cart is a domain aggregate with **totals recomputed server-side** (never trust
  client prices): line prices resolved live, promotions applied (Promotion context),
  tax estimated. Optimistic `version` guards concurrent edits.
- Cart persisted (partitioned, short TTL) → enables **abandoned-cart** (Marketing).

### 2.4 Checkout (orchestrated, idempotent)
```
POST /store/v1/checkout                              start from cart → checkout session
PUT  /store/v1/checkout/{id}/email
PUT  /store/v1/checkout/{id}/shipping-address
PUT  /store/v1/checkout/{id}/shipping-method         (rates from Shipping context)
PUT  /store/v1/checkout/{id}/billing-address
POST /store/v1/checkout/{id}/actions/tax             recompute tax (native/adapter)
POST /store/v1/checkout/{id}/payment                 create payment intent
POST /store/v1/checkout/{id}/actions/complete        → Order (Phase 8), idempotent
```
- Multi-step but stateless per call; the checkout session holds progress.
- `complete` reserves inventory (Phase 7), captures/authorizes payment, and emits
  `OrderPlaced` — all under idempotency key.

### 2.5 Customer account
```
POST /store/v1/customers                             register (website-scoped)
POST /store/v1/customers/actions/login | logout | refresh
GET  /store/v1/me                                    profile
GET  /store/v1/me/orders                             order history
GET  /store/v1/me/addresses (+ CRUD)
GET  /store/v1/me/store-credit
GET  /store/v1/me/downloads                          digital products
```

### 2.6 Wishlist & reviews
```
GET/POST /store/v1/me/wishlists (+ items)
GET  /store/v1/products/{id}/reviews
POST /store/v1/products/{id}/reviews                 (moderated → status=pending)
```

### 2.7 Content (CMS)
```
GET /store/v1/content/pages/{handle}                 per-store-view CMS page
GET /store/v1/content/blocks/{code}                  reusable block
GET /store/v1/content/blog/{...}                     blog posts
```

---

## 3. Performance model

| Path | Strategy |
|------|----------|
| PLP / facets / search | OpenSearch; results cached per (query, store_view, page) in Redis |
| PDP | Redis cache-aside (invalidate on product/price/stock events); CDN for media |
| Anonymous GETs | `Cache-Control` + CDN edge cache; vary on store-view + currency |
| Cart/checkout | No caching; Redis for session; DB writes through domain |
| Personalized (logged-in price) | Bypass CDN; short Redis TTL keyed by group |

Event-driven cache invalidation: `PriceChanged`/`StockMoved`/`ProductPublished` →
invalidate the specific keys, not blanket flush.

---

## 4. Trade-offs

- **Server-side total recomputation** is a little slower per cart call but is the only
  safe design — client-supplied prices are never trusted.
- **CDN caching with a store-view/currency vary key** multiplies cache entries; bounded
  because store views are few and finite.
- **Search-served PLP** means the DB and index can briefly diverge; acceptable with
  near-real-time indexing (Phase 6) and DB as fallback source of truth.

## 5. Platform comparison

| Concern | Shopify Storefront API | Magento | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|------------------------|---------|--------|--------|---------------|-----------------|
| Headless-first | ✓ (GraphQL) | Bolted on (PWA Studio) | ✓ GraphQL | ✓ REST | ✓ | **✓ REST + optional GraphQL** |
| Store-view scoping | Markets | ✓ | Channels | Regions | Channels | **First-class context resolution** |
| Facets/search | Search-driven | Layered nav (DB+ES) | ES/vector | Meilisearch/ES | ✓ | **OpenSearch, cached** |
| Cart trust model | Server | Server | Server | Server | Server | **Server-recomputed, versioned** |

*Next: `plan/06-search-architecture.md`.*

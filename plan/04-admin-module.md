# Phase 4 — Admin (Merchant) Module Design

> The back-office. Same domain/application layers as everything else; this phase
> defines admin-specific concerns: RBAC, catalog authoring UX contracts, bulk ops,
> publishing/versioning workflow, and operational tooling.

---

## 1. Admin architecture

- **Admin API** (`/admin/v1`) + a decoupled admin SPA (framework-agnostic; the API is
  the contract). Server-driven where helpful (config-driven forms for attribute sets).
- **RBAC** tables: `role`, `permission`, `role_permission`, `user`, `user_role`,
  `user_store_scope` (a user may be limited to specific websites/stores).
- Every admin action is **audited** (`audit_log`, actor = admin user).
- All list endpoints support the Phase-3 filter/sort/cursor/expand contract.

---

## 2. Catalog authoring (the core admin workflow)

### 2.1 Attribute Set builder
Endpoints:
```
POST   /admin/v1/attribute-sets            create set
POST   /admin/v1/attribute-sets/{id}/groups
POST   /admin/v1/attributes                 create reusable attribute (+ options)
POST   /admin/v1/attribute-sets/{id}/attributes   assign attr → group + sort
```
- The admin UI renders the **product editor dynamically** from the product's
  attribute set: groups become tabs/sections, attributes become typed inputs driven
  by `data_type`/`input_type`/`validation_rules`/`placeholder`/`tooltip`.
- Changing an attribute's `is_filterable`/`is_variant_forming` triggers a **search
  reindex event** and, for variant-forming changes, a guard preventing removal while
  variants depend on it.

### 2.2 Product editor
- **Scope switcher** in the UI: edit at Global / Website / Store View. Saving a value
  at a non-global scope writes a scoped `product_attribute_value` row (override);
  "reset to default" deletes the override. This is the concrete UI for the scope
  resolver.
- **Variant matrix generator:** pick variant-forming attributes + options → preview
  the cartesian grid → bulk-create `product_variant` + `variant_axis_value`, each
  editable (SKU, price override, weight, images, stock).
- **Metafields panel:** grouped by `metafield_definition.group_name`; JSON/richtext/
  file editors per type.
- **Media manager:** upload → MinIO/S3 via presigned PUT → `media_asset` row; assign
  roles/positions; per-variant and per-store-view imagery.

### 2.3 Publishing & versioning workflow
- Product status `draft → active → archived`; **scheduled publish** via `product_version`
  + a BullMQ cron that flips the published pointer at `published_at`.
- "Save draft" writes a new `product_version` snapshot; "Publish" points live at it;
  "Rollback" repoints to an earlier version. Full audit by construction.

---

## 3. Other admin domains (endpoint groups)

| Area | Key admin capabilities |
|------|------------------------|
| **Categories** | Tree editor (drag-reorder → updates LTREE path + closure); dynamic-collection rule builder; per-store visibility; landing-page link |
| **Pricing** | Manage price lists (base/special/tier/wholesale/B2B), scheduled prices, per-currency prices, customer-group prices |
| **Inventory** | Warehouses, stock adjustments (writes ledger — Phase 7), low-stock thresholds/alerts, movement history, reservations view |
| **Orders** | Search/filter, detail, actions (capture/refund/cancel/hold), fulfillments, shipments, invoices, returns (Phase 8) |
| **Customers** | Accounts, groups, addresses, order history, store-credit balance, GDPR export/erase |
| **Promotions** | Cart-rule & catalog-rule builder (condition tree), coupons (bulk gen), gift cards, store credit |
| **CMS** | Pages, reusable blocks, widgets, blogs — per-store-view content; draft/publish |
| **Marketing** | Campaign config, abandoned-cart rules, loyalty/referral toggles (hooks) |
| **Store config** | Websites/stores/store-views, themes, languages, currencies, tax, shipping, payment methods, feature flags |
| **SEO** | URL rewrites, redirects, robots, sitemap regen, structured-data templates |
| **Analytics** | Dashboards (Phase reads from analytics read-model) |
| **System** | Users/roles, API keys, webhooks, job monitor, audit log viewer |

---

## 4. Bulk & operational tooling

- **Bulk import/export** (CSV/JSONL) for products/prices/inventory → async BullMQ jobs
  with row-level error reports; `202 + job id`, progress via `/jobs/{id}`.
- **Job monitor** UI over BullMQ (queues, failures, retries, DLQ).
- **Reindex controls** (full/partial OpenSearch rebuild).
- **Audit log viewer** with entity/actor/time filters + JSON diff view.

---

## 5. Trade-offs

- **Dynamic, metadata-driven forms** (from attribute sets) are more upfront work than
  hardcoded product forms, but they're the entire point — merchants define catalog
  shape without code. This is the Magento-admin strength, delivered with a cleaner API.
- **Scope-aware editing UX** adds cognitive load; mitigated by defaulting to Global and
  clearly badging overrides.
- **Versioning every save** costs storage; mitigated by snapshotting only on
  publish/explicit-draft, not every keystroke, and pruning old versions on a schedule.

## 6. Platform comparison

| Concern | Shopify Admin | Magento Admin | Medusa Admin | commercetools MC | **OMEcommerce Admin** |
|--------|---------------|---------------|--------------|------------------|-----------------------|
| Custom attribute authoring | Metafields (flat) | Attribute sets (powerful, clunky) | Limited | Product types | **Attribute sets, dynamic forms, scope-aware** |
| Multi-store editing | Markets (limited) | Per-scope (magic ids) | Channels | Stores | **Explicit scope switcher + override reset** |
| Bulk ops | Good | Heavy/slow | Basic | API-driven | **Async jobs + row error reports** |
| Publishing workflow | Basic | Staging (Commerce only) | Basic | Versioned | **Draft/schedule/rollback via versions** |

*Next: `plan/05-storefront-apis.md`.*

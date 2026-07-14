# Phase 7 — Inventory Architecture

> The financial-integrity core alongside orders. Design principle (from master plan
> §4): **current stock is a projection of an immutable, append-only movement ledger.**
> Reservations are race-safe; every quantity change is auditable.

---

## 1. Model

```
warehouse ──< stock_item >── product_variant        (qty per variant per warehouse)
stock_item ──< stock_movement   (append-only ledger; the source of truth)
stock_item ──< stock_reservation (soft holds for carts/orders)
warehouse ──< store_warehouse >── store             (which warehouses serve which store)
```

**`warehouse`** `id, code, name, type (physical/virtual/dropship), address, priority,
is_active, deleted_at`.

**`stock_item`** — one row per (variant, warehouse)
| col | type | notes |
|-----|------|-------|
| id | BIGINT PK | |
| variant_id | BIGINT FK | (simple products use their implicit variant) |
| warehouse_id | BIGINT FK | |
| on_hand | INT | **projection**: sum of movements |
| reserved | INT | **projection**: sum of active reservations |
| available | INT GENERATED | `on_hand - reserved` (stored generated column) |
| reorder_point | INT | low-stock threshold |
| reorder_qty | INT | |
| version | INT | optimistic lock |
| UNIQUE (variant_id, warehouse_id) | | |

**`stock_movement`** — append-only, **partitioned by `created_at`**
`id, stock_item_id FK, delta INT (+/-), reason (purchase/sale/return/adjustment/
transfer/reservation_release/correction), ref_type, ref_id (order/return/adjustment),
balance_after INT, note, actor_id, created_at`.

**`stock_reservation`** — soft holds
`id, stock_item_id FK, qty INT, ref_type (cart/order), ref_id, status
(active/committed/released/expired), expires_at, created_at`.
Partial index `WHERE status='active'`.

**`store_warehouse`** — sourcing map `store_id, warehouse_id, priority` (different
inventory per store = different warehouse set + priority per store).

**`inventory_adjustment`** — admin batch header `id, warehouse_id, reason, note,
actor_id, created_at` → lines write `stock_movement`.

---

## 2. Invariants & how they're enforced

1. **`on_hand` always equals `SUM(delta)` for its stock_item.** Every quantity change
   goes through `stock_movement`; `on_hand`/`reserved` are updated in the *same TX* and
   reconciled by a periodic job. Direct writes to `on_hand` are forbidden (enforced by
   repository layer + DB trigger check on reconcile).
2. **Never oversell.** Reservation creation is atomic:
   ```sql
   UPDATE stock_item
      SET reserved = reserved + $qty, version = version + 1
    WHERE id = $id AND (on_hand - reserved) >= $qty AND version = $expected
   RETURNING *;
   ```
   Zero rows updated → insufficient stock (or lost race) → retry/relayer. This is the
   race-safe heart; no `SELECT ... FOR UPDATE` gap.
3. **Movements are immutable.** Corrections are *new* compensating movements, never
   edits. Full history for free.

---

## 3. Reservation lifecycle (ties to cart → order)

```
Add to cart (optional soft hold) ─► reservation(status=active, expires_at=+15m, ref=cart)
Checkout complete ────────────────► reservation → committed; stock_movement(delta=-qty, reason=sale)
Cart abandoned / expiry ──────────► reservation → released; reserved -= qty (BullMQ sweeper)
Order cancelled ──────────────────► compensating movement(+qty) OR release if not yet shipped
Return received ──────────────────► stock_movement(+qty, reason=return)
```
- A **BullMQ cron sweeper** expires stale `active` reservations (releases `reserved`).
- Whether "add to cart" reserves is a **store config toggle** (high-contention flash
  sales → reserve at cart; normal → reserve at checkout).

---

## 4. Multi-warehouse sourcing & availability

- **Availability for a store** = `SUM(available)` over warehouses in `store_warehouse`,
  by priority. Storefront `in_stock`/`stock_qty` is a **projection** pushed to
  OpenSearch and cached; recomputed on `StockMoved` events.
- **Allocation at fulfillment** (Phase 8): pick warehouse(s) by priority / proximity /
  single-shipment preference; split shipments when needed.
- **Transfers** between warehouses = paired movements (`-qty` source, `+qty` dest,
  reason=transfer, same ref).

---

## 5. History, alerts, reporting

- **Inventory history** = query `stock_movement` (partitioned; BRIN on `created_at`).
- **Low-stock alerts:** on each movement, if `available <= reorder_point` emit
  `LowStock` → Marketing/admin notification; a daily digest job too.
- **Adjustments** always create movements (reason=adjustment) with actor + note → audit.
- **Stock movement report / valuation** from the ledger; snapshots cached for dashboards.

---

## 6. Scale considerations

- `stock_movement` is the highest-write table after orders → **range-partitioned by
  month**, BRIN index on `created_at`, older partitions archived.
- `stock_item` stays small (variants × warehouses) and hot → fully indexed, cached
  availability in Redis with event invalidation.
- The atomic-UPDATE reservation avoids lock contention that `SELECT FOR UPDATE` would
  cause under flash-sale load.

---

## 7. Trade-offs

- **Ledger + projection is more complex than a single mutable `qty` column** — but it's
  the difference between "trust me" and "prove it." Auditors, reconciliation, and
  correct oversell prevention all fall out of it. This mirrors double-entry accounting.
- **Projection drift risk** (on_hand vs. sum-of-movements) mitigated by an in-TX update
  + periodic reconcile job that alerts on mismatch.
- **Reservation expiry sweeper** is eventually-consistent (a few minutes of held stock
  after abandonment); tunable via `expires_at`.

## 8. Platform comparison

| Concern | Shopify | Magento 2 (MSI) | WooCommerce | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|---------|-----------------|-------------|--------|--------|---------------|-----------------|
| Multi-warehouse | Locations | MSI sources/stocks | Single (plugins) | Warehouses | Stock locations | Channels/supply | **Warehouses + store sourcing map** |
| Reservations | ✓ | Reservations table (MSI) | ✗ | ✓ | ✓ | ✓ | **Atomic reserve, race-safe, expiring** |
| Ledger/audit | Adjustments | Partial | ✗ | Partial | Basic | Events | **Immutable append-only movement ledger** |
| Oversell safety | Good | Good (MSI) | Weak | Good | Good | Good | **`available>=qty` guarded UPDATE + version** |

*Next: `plan/08-order-management.md`.*

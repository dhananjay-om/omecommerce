# Phase 8 — Order Management

> Cart → Checkout → Order → Fulfillment → Post-order. Orders are immutable financial
> records with a state machine; money is captured at order time (currency snapshot);
> everything is event-driven and idempotent.
>
> **See also:** [plan/15](./15-order-management-enhancement.md) — the concrete
> build-out of admin order operations (invoicing, shipment tracking, email,
> close/export) and the customer-facing storefront order pages on top of the
> foundation this document designed. `plan/15`'s `docs/openapi/order-api.yaml`
> documents the resulting API surface.

---

## 1. Lifecycle overview

```
Cart ──checkout──► Checkout Session ──complete──► Order
                                                    │
        ┌───────────────────────────────┬──────────┴───────────┬─────────────┐
     Payment                        Fulfillment              Invoice        Returns/RMA
   (authorize/capture)          (allocate→ship)           (billing doc)   (refund/restock)
```

Two decoupled state machines on the order:
- **Financial status:** `pending → authorized → paid → partially_refunded → refunded /
  voided`.
- **Fulfillment status:** `unfulfilled → partially_fulfilled → fulfilled → returned`.
- **Order status** (derived/overridable): `pending, processing, on_hold, completed,
  cancelled`.

---

## 2. Core tables

**`order`** — partitioned by `created_at` (50M target)
| col | type | notes |
|-----|------|-------|
| id | BIGINT PK | |
| public_id | UUID v7 | external order number derived separately (`order_number` seq per website) |
| website_id / store_id / store_view_id | scope | order belongs to a store view |
| customer_id | BIGINT NULL | null = guest |
| customer_group_id | snapshot | pricing context at order time |
| email, currency CHAR(3) | | **currency snapshot** |
| status / financial_status / fulfillment_status | enums | |
| subtotal, discount_total, tax_total, shipping_total, grand_total | NUMERIC(18,4) | frozen |
| billing_address_id / shipping_address_id | FK (snapshotted copies) | |
| placed_at, version | | optimistic lock |
| audit (no soft delete — orders are cancelled, never deleted) | | |

**`order_line`** — partitioned with order
`id, order_id FK, product_id, variant_id, sku (snapshot), name (snapshot), qty,
unit_price, tax_amount, discount_amount, row_total, tax_class (snapshot),
fulfilled_qty, refunded_qty`.
> **Snapshotting** sku/name/price/tax onto the line is deliberate: an order must never
> change because a product was later edited or deleted.

**`order_address`** — immutable snapshot of billing/shipping at purchase.
**`order_discount`** — applied promotions snapshot (rule id, code, amount).
**`order_tax_line`** — per-jurisdiction tax breakdown snapshot.

**`payment_transaction`** `id, order_id, method, gateway, type (authorize/capture/
refund/void), amount, currency, status, gateway_ref, raw JSONB, created_at`.

> **Multi-tender orders:** an order may be paid by any mix of gift card + wallet/store
> credit + PSP. Stored-value tenders and the refund-to-store-credit routing are defined
> in `10-gift-cards-wallet-store-credit.md` §6 (they extend this table via
> `order_payment` tender lines). Stored value is applied *before* the PSP at checkout.

**`fulfillment`** `id, order_id, warehouse_id, status, tracking_number, carrier,
shipped_at` · **`fulfillment_line`** `fulfillment_id, order_line_id, qty`.

**`shipment`** / **`invoice`** — documents generated from the order (numbered per
website).

**`return` (RMA)** `id, order_id, reason, status (requested/approved/received/refunded),
created_at` · **`return_line`** `return_id, order_line_id, qty, restock BOOLEAN`.

---

## 3. Checkout → Order (the critical transaction)

`POST /store/v1/checkout/{id}/actions/complete` (idempotent, `Idempotency-Key`):

```
BEGIN
  1. Re-validate cart (prices, availability, promotions) — never trust stale totals
  2. Reserve/commit inventory per line (Phase 7 atomic UPDATE) — abort if insufficient
  3. Compute final totals: pricing (group/tier/special) + promotions + tax
     (native rules OR TaxPort adapter — Avalara/TaxJar) + shipping
  4. Create order + order_line + snapshots (addresses/tax/discounts) + currency snapshot
  5. Write transactional outbox event  OrderPlaced
COMMIT
--- then, outside the money-critical TX ---
  6. Payment authorize/capture via PaymentPort  → payment_transaction
     - on capture success → financial_status=paid, emit OrderPaid
     - on failure → compensate: release inventory, mark checkout failed (saga)
```
- **Saga / compensation:** payment and order creation are decoupled; a failed capture
  triggers inventory release + order void. Idempotency key ensures a retried
  `complete` never double-charges or double-reserves.
- **Currency & tax are frozen** at this moment — historical orders never recompute.

---

## 4. Post-order operations (admin, Phase 4 UI)

| Action | Effect |
|--------|--------|
| **Capture** (if authorized) | payment_transaction(capture) → paid |
| **Fulfill / ship** | allocate warehouse (Phase 7), create fulfillment+shipment, stock_movement(-qty already committed), tracking, `Shipped` event |
| **Partial fulfillment** | per-line fulfilled_qty; status → partially_fulfilled |
| **Invoice** | generate invoice doc + number |
| **Refund** (full/partial) | payment_transaction(refund), refunded_qty per line, financial_status update, `Refunded` event |
| **Return/RMA** | return + return_line; on receive, optional restock → stock_movement(+qty) |
| **Cancel** | if unshipped: void payment + release/restore inventory; status=cancelled |
| **Hold** | on_hold (fraud/manual review) |

Every transition emits an event (email/notification/analytics consumers) and is
audited.

---

## 5. Numbering, idempotency, concurrency

- **Order number:** human-friendly, per-website sequence (`order_number_seq`), distinct
  from the internal id and public UUID.
- **Idempotency:** `idempotency_keys` table keyed on the checkout-complete request →
  returns the same order on retry.
- **Concurrency:** `order.version` optimistic lock guards concurrent admin edits;
  payment callbacks are idempotent on `gateway_ref`.

---

## 6. Events emitted (consumed by Analytics, Marketing, Search, Notifications)

`OrderPlaced, OrderPaid, OrderCancelled, Shipped, Delivered, Refunded, ReturnRequested,
ReturnReceived`. All via outbox → BullMQ, so downstream never blocks checkout.

---

## 7. Scale considerations

- `order` / `order_line` **range-partitioned by month/quarter**; BRIN on `created_at`;
  hot partitions on fast storage, cold archived. 50M orders → partition pruning keeps
  queries fast.
- **Analytics never queries the live order tables directly** — it consumes events into
  a separate read model / aggregate tables (Phase 9 §analytics), protecting OLTP.
- Order search (admin) → optionally its own OpenSearch index for fast filtering across
  50M rows.

---

## 8. Trade-offs

- **Heavy snapshotting** (sku/name/price/tax/address on the order) costs storage and
  duplicates data — but an order is a legal/financial record and MUST be immutable
  against later catalog changes. Non-negotiable.
- **Saga over 2-phase commit** for payment: eventual consistency with compensation is
  simpler and more robust than distributed transactions across gateway + DB.
- **Two status machines** (financial + fulfillment) add modeling overhead vs. one
  status, but real orders genuinely have independent payment and shipping progress
  (paid-but-unshipped, shipped-COD, partial refunds).

## 9. Platform comparison

| Concern | Shopify | Magento 2 | WooCommerce | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|---------|-----------|-------------|--------|--------|---------------|-----------------|
| Order immutability | Snapshots | Quote→Order snapshot | Post-based (mutable-ish) | Snapshots | Snapshots | Snapshots | **Full line/addr/tax snapshots + currency freeze** |
| Payment model | Transactions | Invoice/creditmemo | Gateways | Transactions/webhooks | Payment providers | Payment API | **payment_transaction ledger + saga** |
| Fulfillment | Multi-location | Shipments/MSI | Basic | Fulfillment | Fulfillment | Delivery/parcels | **fulfillment+shipment, partials, warehouse alloc** |
| Returns/RMA | ✓ | Creditmemo/RMA (Commerce) | Plugins | ✓ | ✓ | Returns | **RMA + optional restock via ledger** |
| Status model | Financial+fulfillment | Multiple states | Single | Multiple | Multiple | Multiple | **Separate financial + fulfillment machines** |
| Scale to 50M | Managed | Needs tuning | Poor | Good | Good | Managed | **Partitioned + event-sourced analytics** |

*Next: `plan/09-deployment-architecture.md`.*

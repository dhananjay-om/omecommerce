# Phase 10 — Gift Cards, Store Credit & Customer Wallet

> Stored-value money. Three related-but-distinct instruments, unified under one
> **append-only ledger** design (same principle as the inventory ledger, Phase 7):
> **every balance is a projection of an immutable transaction log.** Money is never
> mutated in place — it is only ever added or spent via a new ledger row. This makes
> stored value auditable, reconcilable, and safe against double-spend.

---

## 1. The three instruments — what each is

| Instrument | Bound to | Transferable | Typical source | Analogy |
|-----------|----------|--------------|----------------|---------|
| **Gift Card** | A **code** (not a customer until redeemed) | ✅ Yes — anyone with the code | Purchased as a product, or admin/promo-issued | A prepaid card you can gift |
| **Store Credit** | A **customer account** | ❌ No | Refunds, returns, goodwill/compensation, loyalty payout | Merchant "owes you" balance |
| **Wallet** | A **customer account** (umbrella) | ❌ No | Top-ups (prepaid), cashback, converted store credit / loyalty | The customer's money-on-file |

> **Design decision:** Store Credit and Wallet are *the same account-level ledger*
> differentiated by a **source/bucket type**, not two separate systems. A Wallet is the
> customer's account; Store Credit is one *bucket* inside it. Gift Cards are separate
> instruments (code-based, transferable) that, on redemption, **either** pay directly at
> checkout **or** load value into the customer's wallet. This avoids duplicating a whole
> ledger while honoring the distinct semantics you asked for.

```
                         ┌──────────────── CUSTOMER WALLET (account-level) ─────────────────┐
                         │   buckets: STORE_CREDIT | PREPAID_TOPUP | CASHBACK | LOYALTY_CONV │
GIFT CARD (code) ──redeem┼─► load into wallet  OR  ─► apply directly at checkout as tender    │
                         └──────────────────────────────────────────────────────────────────┘
```

---

## 2. Common ledger principle (applies to all three)

- **Append-only transaction table** per instrument; **balance = SUM(amount)**.
- Balance is also stored as a **projection column** updated in the same TX and verified
  by a periodic reconcile job (drift alert) — identical pattern to `stock_item`.
- **Money:** `NUMERIC(18,4)` + `currency CHAR(3)` (master plan §4.5). A gift card / wallet
  bucket has a fixed currency; cross-currency spend converts at spend time via the
  Pricing FX rate and records the rate on the transaction.
- **Idempotency:** every credit/debit carries an `idempotency_key` (and `ref_type/ref_id`)
  so a retried checkout or webhook never double-spends or double-credits.
- **Concurrency:** debit uses the same guarded, race-safe UPDATE as inventory
  reservations (see §5) — no oversell of money.
- **Scope:** stored value is **website-scoped** by default (a client may share value
  across store views of one website; not across websites). Configurable to store-view.
- **No soft-delete on ledger rows** — they're immutable; corrections are compensating
  entries. Instruments themselves (the card/account) support status + soft-delete.
- **Audit:** every transaction has `actor_id`, `reason`, `created_at`; sensitive ops
  (issue/adjust/void) also write `audit_log`.

---

## 3. Gift Cards

### 3.1 Tables

**`gift_card`** — the instrument
| col | type | notes |
|-----|------|-------|
| id | BIGINT PK | |
| public_id | UUID v7 | |
| website_id | BIGINT FK | scope |
| code | CITEXT UNIQUE | the redeemable code (stored **hashed** + last-4 for display) |
| code_hash | BYTEA | HMAC/bcrypt of code; raw code shown once at issuance |
| code_last4 | TEXT | for admin/customer display |
| initial_amount | NUMERIC(18,4) | face value |
| balance | NUMERIC(18,4) | **projection** = SUM(gift_card_transaction.amount) |
| currency | CHAR(3) | |
| status | gift_card_status | `active / redeemed / expired / disabled / pending` |
| kind | gift_card_kind | `digital / physical` |
| source | gift_card_source | `purchased / admin_issued / promotional / refund` |
| purchaser_customer_id | BIGINT NULL | who bought it |
| recipient_email / recipient_name / message | | for digital delivery |
| deliver_at | TIMESTAMPTZ NULL | scheduled send |
| order_id / order_line_id | NULL | if bought via an order |
| expires_at | TIMESTAMPTZ NULL | expiry policy |
| version | INT | optimistic lock |
| created_by / created_at / updated_at / deleted_at | audit + soft delete | |

**`gift_card_transaction`** — append-only ledger
`id, gift_card_id FK, type (issue/redeem/refund/adjust/void/expire), amount NUMERIC(18,4)
(+/-), balance_after NUMERIC(18,4), currency, order_id NULL, ref_type, ref_id,
idempotency_key, actor_id, reason, created_at`.
- `issue` = +initial_amount; `redeem` = −amount (spent at checkout); `refund` = +amount
  (money returned to card); `adjust` = admin correction; `void`/`expire` = zero-out.

**`gift_card_product`** (optional link) — a **product of type virtual** flagged
`is_gift_card` with `denominations` (fixed set) or `amount_range` (custom amount). Buying
it → on `OrderPaid`, a BullMQ job **issues** a `gift_card` and emails the recipient.

### 3.2 Gift card as a catalog product (issuance path)
- Merchant creates a **virtual product** `is_gift_card=true` with denominations
  (e.g. 25/50/100) or a min–max custom amount, and a delivery template.
- Buyer adds it to cart with recipient details (email, message, `deliver_at`).
- `OrderPaid` event → `giftcard-issue` job → create `gift_card` (status active or
  pending until `deliver_at`) → email digital code / queue physical fulfillment.

### 3.3 Redemption (at checkout — a tender type)
- Buyer enters a code at checkout → validate (status active, not expired, balance>0,
  website match).
- Gift card becomes a **tender** on the order (see §6): apply up to `min(balance, amount
  due)`; write a `redeem` transaction; if fully spent → status `redeemed`.
- **Partial redemption** supported (card keeps remainder). **Split tender** supported
  (gift card + wallet + card/PSP on one order).
- **Refunds**: refunding an order paid by gift card returns value to the **same card**
  (or issues store credit if the card expired) via a `refund` transaction.

### 3.4 Security
- Codes are **high-entropy**, stored **hashed** (never plaintext), rate-limited on
  lookup, with lockout on repeated invalid attempts (gift-card enumeration is a common
  fraud vector). Raw code shown once at issuance / in the recipient email only.

---

## 4. Customer Wallet & Store Credit

### 4.1 Tables

**`wallet`** — one per (customer, website, currency)
`id, public_id, customer_id FK, website_id FK, currency CHAR(3),
balance NUMERIC(18,4) (projection), status (active/frozen), version INT, audit`.
UNIQUE (customer_id, website_id, currency).

**`wallet_transaction`** — append-only ledger (the heart)
| col | type | notes |
|-----|------|-------|
| id | BIGINT PK | |
| wallet_id | BIGINT FK | |
| bucket | wallet_bucket | `store_credit / prepaid_topup / cashback / loyalty_conversion / refund` |
| type | wallet_txn_type | `credit / debit / hold / release / expire / adjust` |
| amount | NUMERIC(18,4) | +credit / −debit |
| balance_after | NUMERIC(18,4) | running balance |
| currency | CHAR(3) | |
| source | wallet_source | `refund / return / goodwill / topup / cashback / loyalty / giftcard_load / promo` |
| order_id / return_id | NULL | linkage |
| idempotency_key | | |
| expires_at | TIMESTAMPTZ NULL | store-credit expiry policy |
| actor_id / reason / created_at | audit | |

> **Store Credit is simply `wallet_transaction` rows with `bucket='store_credit'`.** The
> customer sees one wallet balance; the merchant can report by bucket (how much is
> refund credit vs. prepaid vs. cashback). This is the unification decision in §1.

**`wallet_hold`** — soft holds during checkout (mirrors inventory reservations)
`id, wallet_id FK, amount, order_id/checkout_id, status (active/committed/released/
expired), expires_at, created_at`. Prevents spending the same balance twice across
concurrent checkouts.

### 4.2 Where balance comes from (credit sources)
- **Refund to store credit** (Phase 8 return/refund) → `credit`, bucket `store_credit`,
  source `refund`/`return`. Often the merchant's preferred refund method (keeps money
  on-platform).
- **Goodwill / compensation** — admin issues credit with reason (audited).
- **Top-up (prepaid wallet)** — customer pays via PSP to load balance → `credit`, bucket
  `prepaid_topup`. (This is the "wallet" you asked for as a fund-in-advance balance.)
- **Cashback / loyalty conversion** — Marketing/loyalty emits events → `credit`.
- **Gift card load** — redeeming a gift card *into* the wallet → `credit`, source
  `giftcard_load` (alternative to spending the card directly at checkout).

### 4.3 Spending (at checkout — a tender type)
- Wallet is a **tender**: apply up to `min(available, amount due)`. Checkout places a
  `wallet_hold`; on order completion the hold is **committed** → `debit`; on
  abandonment/expiry the hold is **released** (BullMQ sweeper, same as inventory).
- **Expiry:** store-credit buckets can expire (`expires_at`); a maintenance job posts an
  `expire` debit and notifies the customer beforehand. Prepaid top-ups typically don't
  expire (jurisdiction-dependent — configurable).
- **Freeze:** fraud/hold → `wallet.status=frozen` blocks debits.

---

## 5. Race-safe debit (money can't be double-spent)

Identical guarded UPDATE to the inventory reservation (Phase 7 §2):
```sql
UPDATE wallet
   SET balance = balance - $amount, version = version + 1
 WHERE id = $id AND balance >= $amount AND status = 'active' AND version = $expected
RETURNING *;
-- 0 rows → insufficient funds OR lost race → do not post the debit; retry/relayer
```
The same applies to `gift_card.balance`. The ledger row is only written when this
UPDATE succeeds, in the same transaction. Holds use the same mechanism against an
`available = balance − active_holds` view.

---

## 6. Integration with Checkout & Orders (Phase 8)

Stored value is modeled as **order tenders**, so a single order can be paid by any mix
of gift card + wallet/store credit + PSP:

**`order_payment` / tender lines** (extends Phase 8 `payment_transaction`)
`id, order_id, tender_type (gift_card / wallet / psp / cod), instrument_ref
(gift_card_id | wallet_id | gateway_ref), amount, currency, status, created_at`.

Checkout-complete flow addition (Phase 8 §3):
```
3b. Apply stored-value tenders FIRST (gift card → wallet), each as a hold/redeem:
      remaining_due = grand_total
      for each stored-value tender: apply min(balance, remaining_due); remaining_due -= applied
    Then charge the PSP for remaining_due (if any).
On success  → commit gift_card.redeem + wallet.debit (holds → committed)
On failure  → release all holds (saga compensation), no value lost
```
- **Idempotency key** on complete guarantees tenders apply exactly once.
- **Refund routing** (Phase 8 refund): configurable order — refund to store credit
  (wallet), or back to gift card, or to original PSP, or a split. Default policy per
  store config.
- **Zero-due orders** (fully paid by stored value) skip the PSP entirely.

---

## 7. Admin & Storefront surface

**Admin** (Phase 4):
```
/admin/v1/gift-cards            list/search (by last4/status/recipient), issue, disable, adjust, resend
/admin/v1/gift-cards/{id}/transactions          full ledger
/admin/v1/customers/{id}/wallet                 balance + buckets
/admin/v1/customers/{id}/wallet/transactions    ledger
/admin/v1/customers/{id}/wallet/actions/credit  issue store credit (reason, expiry) [audited]
/admin/v1/customers/{id}/wallet/actions/freeze
/admin/v1/gift-card-products    denominations config
```
- Bulk gift-card generation (promo campaigns) → async BullMQ job.

**Storefront** (Phase 5):
```
POST /store/v1/checkout/{id}/actions/apply-gift-card     { code }
POST /store/v1/checkout/{id}/actions/apply-wallet        { amount? }   // else max
GET  /store/v1/me/wallet                                 balance + buckets + expiring soon
GET  /store/v1/me/wallet/transactions
GET  /store/v1/me/gift-cards                             cards purchased/received
POST /store/v1/me/wallet/actions/topup                   → PSP → credit prepaid bucket
GET  /store/v1/gift-cards/{code}/balance                 balance check (rate-limited)
```

---

## 8. Events (via outbox → BullMQ; consumed by Notifications/Analytics/Loyalty)

`GiftCardIssued, GiftCardRedeemed, GiftCardRefunded, GiftCardExpired,
WalletCredited, WalletDebited, StoreCreditIssued, StoreCreditExpiring,
WalletToppedUp`.
- Notifications: issue email, low/expiring balance reminders, top-up receipts.
- Analytics: outstanding **liability** reporting (see §9).

---

## 9. Accounting / liability reporting

Outstanding gift-card + wallet balances are a **financial liability** (deferred
revenue) — enterprise finance teams require this. The analytics read model (Phase 9)
maintains:
```
stored_value_liability(website, date, giftcard_outstanding, wallet_outstanding,
                       issued, redeemed, expired, breakage)
```
- **Breakage** (expired unredeemed value) is recognized per policy.
- Revenue is recognized on **redemption**, not issuance (issuance = liability). The
  ledger makes this exact and auditable.

---

## 10. Trade-offs

- **Unifying Store Credit + Wallet into one ledger (buckets)** avoids a duplicate
  subsystem while preserving distinct reporting. The cost: a `bucket`/`source`
  discriminator everywhere — cheap and worth it.
- **Ledger + projection** (vs. a single mutable balance column) is more tables and a
  reconcile job, but it's the only design that's auditable, supports liability
  reporting, and is safe against double-spend — the same call we made for inventory.
- **Gift cards separate from wallet** (not just a bucket) is deliberate: they're
  transferable and code-addressed, with different security (hashed codes, enumeration
  defense) and lifecycle (issued to non-customers). Merging them would break those
  semantics.
- **Holds add eventual consistency** (a few minutes of held value after abandonment),
  tunable via `expires_at` and the sweeper — identical trade to inventory reservations.
- **Multi-currency stored value** is constrained to a fixed currency per instrument to
  avoid FX ambiguity on the balance; cross-currency spend converts at spend time and
  records the rate.

## 11. Platform comparison

| Concern | Shopify | Magento 2 | WooCommerce | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|---------|-----------|-------------|--------|--------|---------------|-----------------|
| Gift cards | ✓ (native, code-based) | ✓ (Commerce only; Open Source needs ext) | Plugins | ✓ (gift cards) | Plugin/community | Via custom | **Native, hashed codes, product-issued, ledgered** |
| Store credit | Store credit (newer) | Customer store credit (Commerce) | Plugins | Partial | Plugin | Custom | **Wallet ledger, bucketed, refund-routable** |
| Wallet / prepaid top-up | ✗ (no true prepaid) | ✗ (ext only) | Plugins | ✗ | ✗ | ✗ | **First-class prepaid wallet + top-up** |
| Split tender (GC+credit+PSP) | ✓ | Partial | Weak | Partial | Partial | Custom | **Native multi-tender orders** |
| Double-spend safety | Managed | DB locks | Weak | — | — | — | **Guarded UPDATE + holds (race-safe)** |
| Liability/breakage reporting | Managed | Reports (Commerce) | ✗ | ✗ | ✗ | Custom | **Event-sourced liability read model** |

---

*Cross-references: tender integration → `08-order-management.md` §3/§refunds;
ledger pattern → `07-inventory-architecture.md` §2; issuance product type →
`01-domain-model-and-erd.md` §6 (virtual product); admin/storefront surfaces →
`04`/`05`; liability read model → `09-deployment-architecture.md` §5.*

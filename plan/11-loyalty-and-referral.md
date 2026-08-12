# Phase 11 — Loyalty & Referral Programs

> Two engagement engines built on the same primitives as the rest of the platform:
> **points are an append-only ledger** (like wallet/inventory), earning is
> **event-driven** (consumes `OrderPaid`, `ReviewApproved`, `CustomerRegistered`, …),
> and **rewards are issued through the Phase 10 stored-value system** (store credit /
> gift card / coupon / points). Nothing here reinvents money movement — it reuses it.

---

## 1. How these connect to what already exists

```
Events (OrderPaid, ReviewApproved, ReferralQualified, Birthday, …)
        │
        ▼
 LOYALTY engine ──earn──► loyalty_account (points ledger)  ──redeem──►  ┐
                                                                        ├─► reward issued as:
 REFERRAL engine ──qualify──► referral reward rules ────────────────────┘     • store credit / wallet  (Phase 10)
                                                                              • gift card               (Phase 10)
                                                                              • coupon                  (Promotion)
                                                                              • loyalty points          (this phase)
```

- **Loyalty** = ongoing earn-and-burn points + tiers for *all* customers.
- **Referral** = one customer invites another; both get rewarded on a qualifying action.
- **Reward issuance is shared** — both engines emit a "grant reward" intent that the
  stored-value / promotion contexts fulfill. This keeps one audited money path.
- **Points are a liability** (deferred value) → reported alongside gift-card/wallet
  liability in the analytics read model (Phase 9 §5 / Phase 10 §9).

---

## 2. Loyalty Program

### 2.1 Tables

**`loyalty_program`** — config (one active per website, versioned)
`id, website_id FK, name, status (active/paused/ended), points_currency_name
("Stars"), point_value NUMERIC(18,6) (1 point = $X for redemption), rounding_rule,
earn_base ("per_currency_unit"), redeem_min_points, redeem_step, points_expiry_months,
scope, created_by, audit`.

**`loyalty_earn_rule`** — how points are earned (multiple, prioritized)
| col | type | notes |
|-----|------|-------|
| id | BIGINT PK | |
| program_id | BIGINT FK | |
| trigger | loyalty_trigger | `order_paid / product_purchase / signup / review / birthday / referral / newsletter / social / custom` |
| condition | JSONB | rule tree (category, min spend, customer group, store view, date window) |
| earn_type | enum | `points_per_currency / fixed_points / multiplier` |
| earn_value | NUMERIC | e.g. 1 pt / $1, or 100 pts flat, or 2× |
| max_points_per_event | INT NULL | cap |
| starts_at / ends_at | | campaign windows (double-points weekend) |
| priority | INT | |
| is_active | BOOLEAN | |

**`loyalty_account`** — one per (customer, program)
`id, customer_id FK, program_id FK, points_balance BIGINT (projection),
lifetime_points BIGINT, tier_id FK NULL, tier_progress BIGINT, status, version, audit`.
UNIQUE (customer_id, program_id).

**`loyalty_transaction`** — append-only points ledger (the heart)
`id, loyalty_account_id FK, type (earn/redeem/expire/adjust/reverse), points BIGINT
(+/-), balance_after BIGINT, source (order/review/referral/signup/admin/…),
order_id NULL, ref_type, ref_id, idempotency_key, expires_at TIMESTAMPTZ NULL,
actor_id, reason, created_at`.
- `earn` = +points (with `expires_at` per program policy); `redeem` = −points;
  `expire` = −points (maintenance job); `reverse` = −points when an order that earned
  them is refunded/cancelled (clawback).

**`loyalty_tier`** — tier definitions (Bronze/Silver/Gold/Platinum)
`id, program_id FK, name, threshold BIGINT (lifetime pts or rolling spend),
threshold_basis (lifetime_points / rolling_12m_spend), benefits JSONB
(earn_multiplier, free_shipping, exclusive_access, birthday_bonus), sort_order`.

**`loyalty_reward`** — optional reward catalog (spend points on things)
`id, program_id FK, type (discount / free_product / free_shipping / gift_card /
wallet_credit), cost_points BIGINT, value JSONB, stock NULL, is_active`.

**`loyalty_redemption`** — a redemption event
`id, loyalty_account_id FK, reward_id NULL, points_spent BIGINT, issued_as
(coupon/store_credit/gift_card/order_discount), issued_ref_id, order_id NULL,
status, created_at`.

### 2.2 Earning (event-driven, idempotent)

```
OrderPaid event ──► loyalty queue ──► earn worker:
   - resolve customer's loyalty_account (create if first)
   - evaluate active loyalty_earn_rule set (order-level + line-level product/category)
   - apply tier earn_multiplier + any campaign multiplier
   - post loyalty_transaction(earn, +points, expires_at = now + expiry_months)
   - recompute tier (see 2.4)
   - emit LoyaltyPointsEarned
```
- **Idempotency** on `(order_id, rule_id)` so a replayed event never double-earns.
- **Pending → confirmed**: points from an order can be held `pending` until the return
  window closes (config), then confirmed — avoids clawback churn. Modeled as an
  `earn` row with a `confirmed_at`/status, or a `hold` then `earn`.
- **Clawback**: `OrderRefunded/Cancelled` → `reverse` transaction removing the
  proportional points (guarded so balance can't go negative → recorded as debt if
  configured).

### 2.3 Redeeming (at checkout — via stored value)

Points are **not** a raw checkout tender; they convert into a concrete instrument so
the order/refund math stays in dollars:
```
POST /store/v1/checkout/{id}/actions/redeem-points { points }
   - validate: points <= balance, >= redeem_min, multiple of redeem_step
   - convert: amount = points * program.point_value
   - post loyalty_transaction(redeem, -points)
   - issue as an order-level discount (or wallet store-credit) → Phase 8 tender / Phase 10
   - guarded UPDATE on loyalty_account.points_balance (race-safe, same as wallet §5)
```
Or redeem a **catalog reward** (`loyalty_reward`) → issues a coupon / gift card / free
shipping. Either way it flows through existing money paths, fully audited.

### 2.4 Tiers

- Tier recomputed on every earn (and by a nightly job for rolling-window bases):
  `tier = highest loyalty_tier whose threshold <= basis`.
- **Rolling spend basis** (e.g. last 12 months) → maintained from order events; a
  scheduled job demotes customers who drop below threshold (with a grace period).
- Tier benefits (earn multiplier, free shipping, early access) are read at
  earn/checkout time; free-shipping/early-access enforced by Shipping/Catalog contexts.

### 2.5 Expiry

- Maintenance job posts `expire` debits for `earn` rows past `expires_at`
  (FIFO consumption: oldest points spent first, tracked via `expires_at` ordering).
- Pre-expiry reminder emails via Notifications (`LoyaltyPointsExpiring`).

---

## 3. Referral Program

### 3.1 Tables

**`referral_program`** — config
`id, website_id FK, name, status, referrer_reward JSONB, referee_reward JSONB,
qualifying_event (signup / first_order / min_spend_order), min_order_amount,
reward_issue_as (store_credit / gift_card / coupon / points), max_referrals_per_customer,
reward_cap_per_period, attribution_window_days, self_referral_block, scope, audit`.

**`referral_code`** — a referrer's shareable code/link
`id, program_id FK, referrer_customer_id FK, code CITEXT UNIQUE, share_url,
uses_count, status, created_at`. (One+ per customer.)

**`referral`** — a tracked referral relationship
| col | type | notes |
|-----|------|-------|
| id | BIGINT PK | |
| program_id | BIGINT FK | |
| referral_code_id | BIGINT FK | |
| referrer_customer_id | BIGINT FK | |
| referee_customer_id | BIGINT NULL | set when invitee registers |
| referee_email | TEXT NULL | pre-signup capture |
| status | referral_status | `invited / signed_up / qualified / rewarded / rejected / expired` |
| qualifying_order_id | BIGINT NULL | |
| attribution_at | TIMESTAMPTZ | click/first-touch |
| qualified_at / rewarded_at | | |
| fraud_flags | JSONB | |
| created_at | | |

**`referral_reward`** — reward grants (both sides)
`id, referral_id FK, beneficiary (referrer/referee), reward_type, amount/points,
issued_as, issued_ref_id (wallet_txn / gift_card / coupon / loyalty_txn), status,
created_at`.

### 3.2 Flow

```
1. Referrer shares code/link  → referral_code
2. Referee clicks link        → attribution cookie/param; referral(status=invited)
3. Referee registers          → referral(referee_customer_id set, status=signed_up)
                                 → maybe issue referee welcome reward immediately (config)
4. Referee completes qualifying event (first order ≥ min_spend)
                                 → status=qualified, qualifying_order_id set
5. Reward both sides           → referral_reward rows → issued via Phase 10 / Promotion:
                                    referrer: store credit / gift card / points
                                    referee:  discount coupon / store credit
                                 → status=rewarded; emit ReferralQualified/Rewarded
```
- **Idempotent** on `referral_id` + beneficiary so double-reward is impossible.
- **Referee reward** often granted at signup (incentive to convert); **referrer reward**
  gated on the referee's *qualifying* action (prevents farming).

### 3.3 Fraud & abuse controls (critical for referral)

| Risk | Control |
|------|---------|
| Self-referral | Block same email/customer; device/IP fingerprint match → `fraud_flags` |
| Fake accounts | Require qualifying **paid** order (not just signup) for referrer payout |
| Reward farming | `max_referrals_per_customer`, `reward_cap_per_period`, velocity checks |
| Chargeback abuse | Clawback referrer reward if the qualifying order is refunded (reverse) |
| Attribution gaming | `attribution_window_days`; first-touch vs last-touch policy |
- All payouts run through the audited stored-value ledger, so abuse is traceable and
  reversible.

---

## 4. Shared reward-issuance service

Both engines call one **`RewardIssuer`** application service so there's a single,
audited path to grant value:
```
issueReward({ beneficiaryCustomerId, type, amount|points, issueAs, source, refId, idempotencyKey })
   → store_credit  : wallet_transaction credit (Phase 10)
   → gift_card     : gift_card issue (Phase 10)
   → coupon        : single-use coupon (Promotion context)
   → points        : loyalty_transaction earn (this phase)
   → emits RewardIssued  (Notifications, Analytics)
```
This is the integration seam that keeps loyalty, referral, refunds, and promos from
each inventing their own money movement.

---

## 5. API surface

**Storefront** (Phase 5):
```
GET  /store/v1/me/loyalty                     balance, tier, progress, expiring points
GET  /store/v1/me/loyalty/transactions        points ledger
GET  /store/v1/loyalty/rewards                reward catalog
POST /store/v1/checkout/{id}/actions/redeem-points
GET  /store/v1/me/referrals                    my code, invited, rewards earned
POST /store/v1/me/referrals/invite            send invites (emails)
GET  /store/v1/referrals/{code}               landing/attribution
```
**Admin** (Phase 4):
```
/admin/v1/loyalty/programs, /earn-rules, /tiers, /rewards
/admin/v1/loyalty/accounts/{id}/adjust        manual points [audited]
/admin/v1/referral/programs, /referrals        review/approve/reject, fraud queue
/admin/v1/loyalty/reports                      liability, redemption rate, ROI
```

---

## 6. Events (outbox → BullMQ)

`LoyaltyPointsEarned, LoyaltyPointsRedeemed, LoyaltyPointsExpiring, LoyaltyPointsExpired,
TierUpgraded, TierDowngraded, ReferralInvited, ReferralSignedUp, ReferralQualified,
ReferralRewarded, RewardIssued`.
- Consumed by Notifications (emails), Analytics (program ROI, liability), Marketing
  (campaign triggers).

---

## 7. Analytics & liability

Program health in the analytics read model (Phase 9 §5):
```
loyalty_liability(website, date, points_outstanding, points_value, issued, redeemed,
                  expired, breakage, redemption_rate)
referral_perf(program, period, invites, signups, qualified, reward_cost, CAC, ROI)
```
- **Outstanding points are a liability** (like gift-card/wallet value) — reported
  together for finance.
- **Referral CAC** (reward cost per acquired paying customer) proves program ROI.

---

## 8. Trade-offs

- **Points as a ledger, not a counter** — more tables + a reconcile/expiry job, but it's
  the only design that supports expiry (FIFO), clawback, liability reporting, and audit.
  Consistent with wallet/inventory; the team learns one pattern.
- **Points redeemed via conversion to a concrete instrument** (not a raw tender) keeps
  all order/refund math in currency — simpler, avoids "how do I refund points on a
  partially-points order" ambiguity. Slight indirection cost.
- **Pending→confirmed earning** adds a state but prevents clawback churn from returns;
  configurable off for simplicity.
- **Referral fraud controls add friction** (paid-order gating, caps, fingerprinting) —
  necessary; referral programs are heavily abused. Rewards are reversible because they
  ride the audited ledger.
- **Shared RewardIssuer** couples engines to stored-value/promotion contexts, but that
  coupling is the *point* — one audited money path beats four ad-hoc ones.

## 9. Platform comparison

| Concern | Shopify | Magento 2 | WooCommerce | Saleor | Medusa | commercetools | **OMEcommerce** |
|--------|---------|-----------|-------------|--------|--------|---------------|-----------------|
| Loyalty/points | Apps only (Smile, LoyaltyLion) | Reward Points (Commerce only) | Plugins | ✗ (custom) | ✗ (custom) | ✗ (custom) | **Native points ledger + tiers + rules** |
| Tiers | App | Partial | Plugin | ✗ | ✗ | ✗ | **Native, rolling-spend or lifetime basis** |
| Referral | Apps only | Ext (Commerce/3rd-party) | Plugins | ✗ | ✗ | ✗ | **Native, fraud-controlled, attribution** |
| Points expiry/clawback | App-dependent | ✓ (Commerce) | Plugin | ✗ | ✗ | ✗ | **FIFO expiry + refund clawback** |
| Reward issuance | Fragmented per app | Store credit/coupon | Fragmented | ✗ | ✗ | ✗ | **One audited RewardIssuer → wallet/GC/coupon/points** |
| Liability/ROI reporting | App | Reports (Commerce) | ✗ | ✗ | ✗ | Custom | **Event-sourced points liability + referral CAC/ROI** |

> **Positioning:** on every mainstream platform, loyalty *and* referral are paid
> third-party apps bolted on with their own siloed balances. Here they're **native,
> share the stored-value ledger, and report as financial liability** — a real
> enterprise differentiator.

---

*Cross-references: reward issuance → `10-gift-cards-wallet-store-credit.md` §4/§6
(wallet, gift card) and Promotion (coupons); earning events → `08-order-management.md`
§6; ledger pattern → `07-inventory-architecture.md` §2; liability read model →
`09-deployment-architecture.md` §5; program admin/storefront → `04`/`05`.*

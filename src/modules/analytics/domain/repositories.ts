/**
 * The analytics read-model's write port (plan/19). Every method here is
 * idempotent — safe to call repeatedly for the same (dateKey, websiteId)
 * bucket — because each one fully RE-AGGREGATES that bucket from the OLTP
 * tables rather than applying a manual increment/decrement delta. This is a
 * deliberate refinement over plan/19 §2's "incremental delta" language: a
 * full recompute of one bounded day is cheap, and it means the event-driven
 * projector and the nightly batch refresh share the exact same code path —
 * no separate "apply this event's delta" logic to keep in sync with the
 * "recompute from scratch" logic, which is exactly the class of bug (double-
 * counted/under-counted rows after a cancel or refund) manual deltas invite.
 */
export interface AnalyticsRepository {
  /** Recomputes and upserts every order-derived summary_* row (sales, order-
   *  status, product, category, payment-method, return) for one
   *  (dateKey, websiteId) bucket, straight from `order`/`order_line`/
   *  `payment_transaction`/`order_return`. */
  refreshOrderSummaries(dateKey: number, websiteId: bigint): Promise<void>;

  /** Recomputes summary_fulfillment_daily for one (dateKey, websiteId) from
   *  `order`/`fulfillment`. Separate from refreshOrderSummaries() because it
   *  answers a different question (how long did fulfillment take, not how
   *  much did we sell) and touches different tables. */
  refreshFulfillmentSummary(dateKey: number, websiteId: bigint): Promise<void>;

  /** Snapshots current `stock_item` state into summary_inventory_daily for
   *  one day — a point-in-time snapshot, not an order-derived aggregate, so
   *  it isn't scoped by website (stock isn't website-scoped in this schema). */
  snapshotInventory(dateKey: number): Promise<void>;

  /** Recomputes RFM scores for the whole customer population, in place
   *  (upserts every customer_rfm row; deletes rows for customers who no
   *  longer have any qualifying order history, so the table never carries
   *  a stale segment for a customer whose only orders were later voided). */
  refreshCustomerRfm(): Promise<void>;

  /** Every distinct websiteId with an order placed on `dateKey` — the
   *  projector/refresh workers use this to know which buckets exist to
   *  refresh, rather than hardcoding a website list. */
  listActiveWebsiteIds(dateKey: number): Promise<bigint[]>;

  /** Compares OLTP aggregates against summary_sales_daily for one day and
   *  writes one reconciliation_log row per (website, currency) bucket found
   *  in either source — including a clean "0 diff" row when they agree, so
   *  the reconciliation dashboard (plan/19 §12) has a complete daily record,
   *  not just a log of failures. */
  reconcileDay(dateKey: number): Promise<void>;
}

import type { Job } from 'bullmq';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { createAnalyticsProjectorDeps } from '../modules/analytics/analytics.module.js';
import { dateKeyOf } from '../modules/analytics/domain/date-key.js';
import { logger } from '../shared/infrastructure/logger.js';

/** Every order-lifecycle event that can move a number in a summary_* row —
 *  aggregateType 'Order', aggregateId = Order.publicId for all eight (see
 *  the outbox call sites: prisma-order.repository.ts, complete-checkout,
 *  mark-order-paid-manually, prisma-company-order-settlement,
 *  cancel-order, refund-order, fulfill-order, close-order, delete-order
 *  usecases). Deliberately excludes StockChanged: the Inventory dashboard's
 *  live "low stock now" widget reads stock_item directly (see
 *  SummaryInventoryDaily's own doc comment) — that table is nightly-
 *  snapshot-only, nothing here needs to react to it in real time. */
const ORDER_LIFECYCLE_EVENTS = new Set(['OrderPlaced', 'OrderPaid', 'OrderPaymentFailed', 'OrderCancelled', 'OrderRefunded', 'Shipped', 'OrderClosed', 'OrderDeleted']);

/**
 * Event-driven analytics projector — recomputes the affected day's
 * summary_* buckets the moment an order-lifecycle event fires (plan/19 §2's
 * "incremental" path; the nightly refresh worker is the batch/catch-up
 * path sharing the exact same RefreshWebsiteDay usecase).
 *
 * Refreshes TWO buckets, not one: the order's own `placedAt` day (sales/
 * status/product/category counts are bucketed by placement date) AND the
 * event's processing day (payment-method/return counts are bucketed by
 * when the transaction or return itself happened, which can be a later
 * day than placement — e.g. a refund issued a week after the order was
 * placed). Both refreshes are cheap, idempotent full re-aggregations
 * (domain/repositories.ts's header comment), so doing both unconditionally
 * is simpler and safer than trying to special-case which event affects
 * which bucket.
 */
export function createAnalyticsProjectorHandler(): (job: Job) => Promise<void> {
  const { refreshWebsiteDay } = createAnalyticsProjectorDeps(prisma);

  return async (job: Job) => {
    if (!ORDER_LIFECYCLE_EVENTS.has(job.name)) return;
    const { aggregateId } = job.data as { aggregateId: string };
    try {
      // 'OrderDeleted' can't be looked up by aggregateId — the whole point
      // is the order row is already gone by the time this runs — so it
      // carries websiteId/placedAt directly in its own payload instead
      // (see delete-order.usecase.ts). Every other event still looks the
      // order up fresh, which also correctly picks up a since-changed
      // placedAt (e.g. a backdated demo/seed order) without needing its
      // own special case.
      let websiteId: bigint;
      let placedAt: Date;
      if (job.name === 'OrderDeleted') {
        const payload = job.data.payload as { websiteId: string; placedAt: string };
        websiteId = BigInt(payload.websiteId);
        placedAt = new Date(payload.placedAt);
      } else {
        const order = await prisma.order.findUnique({ where: { publicId: aggregateId }, select: { websiteId: true, placedAt: true } });
        if (!order) return; // shouldn't happen — an order event always has a real order — but never let a projector crash the worker over it
        websiteId = order.websiteId;
        placedAt = order.placedAt;
      }

      const placedDateKey = dateKeyOf(placedAt);
      const nowDateKey = dateKeyOf(new Date());
      await refreshWebsiteDay.execute({ dateKey: placedDateKey, websiteId });
      if (nowDateKey !== placedDateKey) {
        await refreshWebsiteDay.execute({ dateKey: nowDateKey, websiteId });
      }
    } catch (err) {
      logger.error({ err, orderId: aggregateId, eventType: job.name }, 'analytics projector failed');
    }
  };
}

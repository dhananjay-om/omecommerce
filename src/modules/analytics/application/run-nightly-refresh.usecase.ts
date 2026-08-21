import type { AnalyticsRepository } from '../domain/repositories.js';
import { RefreshWebsiteDay } from './refresh-website-day.usecase.js';

/** The nightly batch path (plan/19 §2's "reconciliation batch" — runs on
 *  MAINTENANCE_QUEUE via analytics-refresh.worker.ts, plan/19 §11). For a
 *  given dateKey (normally "yesterday" in UTC): re-derives every active
 *  website's order/fulfillment summaries from scratch (the same
 *  RefreshWebsiteDay the event-driven projector uses — this is the
 *  catch-up/self-healing pass for any event the projector ever missed, not a
 *  parallel code path that could drift from it), snapshots inventory once
 *  (not website-scoped), recomputes the whole customer_rfm population once,
 *  then writes a reconciliation_log row per (website, currency) bucket so
 *  drift is visible on the Reconciliation dashboard (plan/19 §12) even when
 *  there isn't any. */
export class RunNightlyRefresh {
  constructor(
    private readonly analytics: AnalyticsRepository,
    private readonly refreshWebsiteDay: RefreshWebsiteDay,
  ) {}

  async execute(dateKey: number): Promise<void> {
    const websiteIds = await this.analytics.listActiveWebsiteIds(dateKey);
    for (const websiteId of websiteIds) {
      await this.refreshWebsiteDay.execute({ dateKey, websiteId });
    }
    await this.analytics.snapshotInventory(dateKey);
    await this.analytics.refreshCustomerRfm();
    await this.analytics.reconcileDay(dateKey);
  }
}

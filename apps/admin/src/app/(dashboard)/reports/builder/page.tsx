import { apiGet } from '@/lib/api-client';
import type { ReportMetricDefinition, SavedReportView } from '@/lib/types';
import { ReportBuilderClient } from './report-builder-client';

/**
 * Report Builder (plan/19) — a curated set of this store's real reports,
 * not an arbitrary pivot tool: pick one of the 14 registered metrics, a
 * date range, run it, export the CSV, or save it to re-run later. Both
 * the metric registry and the saved-reports list are fetched here in
 * parallel and handed down as props, so the client component's first
 * paint doesn't wait on a client-side fetch waterfall.
 */
export default async function ReportBuilderPage() {
  const [metrics, savedReports] = await Promise.all([
    apiGet<ReportMetricDefinition[]>('/admin/v1/analytics/report-metrics'),
    apiGet<SavedReportView[]>('/admin/v1/analytics/saved-reports'),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Report Builder</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a metric and a date range, run it, export the results, or save it to re-run later — not an arbitrary pivot tool, a curated set of
        this store&apos;s real reports.
      </p>

      <div className="mt-6">
        <ReportBuilderClient metrics={metrics} savedReports={savedReports} />
      </div>
    </div>
  );
}

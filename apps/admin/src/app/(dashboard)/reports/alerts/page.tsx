import { apiGet } from '@/lib/api-client';
import type { AlertRuleView, AlertMetricCode, AlertComparator } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertRuleDialog } from './alert-rule-dialog';
import { DeleteAlertRuleDialog } from './delete-alert-rule-dialog';

const METRIC_LABELS: Record<AlertMetricCode, string> = {
  REVENUE_DROP: 'Revenue drop',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  PAYMENT_FAILURE_RATE: 'Payment failure rate',
  RETURN_RATE: 'Return rate',
  ORDER_STUCK: 'Order stuck',
};

const COMPARATOR_LABELS: Record<AlertComparator, string> = {
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal',
  lte: 'less than or equal',
};

/** Truncate a joined recipient list for the table cell — the full list is
 *  still visible (and editable) inside the row's Edit dialog. */
function formatRecipients(emails: string[]): string {
  const joined = emails.join(', ');
  return joined.length > 48 ? `${joined.slice(0, 45)}…` : joined;
}

/**
 * Alert Rules config (plan/19 §6.7) — CRUD over /admin/v1/analytics/alert-rules,
 * mirrors content/widgets/page.tsx's list+dialog shape rather than the other
 * /reports/* chart dashboards. Rules aren't date-ranged, and there's no
 * manual "run now" — the nightly analytics refresh worker evaluates every
 * active rule and emails recipientEmails when its threshold is crossed.
 */
export default async function AlertRulesPage() {
  const rules = await apiGet<AlertRuleView[]>('/admin/v1/analytics/alert-rules');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evaluated automatically every night by the analytics refresh worker — there is nothing to trigger manually.
          </p>
        </div>
        <AlertRuleDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Comparator</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Window (days)</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No alert rules yet.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.publicId}>
                  <TableCell className="font-medium">{METRIC_LABELS[rule.metricCode] ?? rule.metricCode}</TableCell>
                  <TableCell className="text-muted-foreground">{COMPARATOR_LABELS[rule.comparator] ?? rule.comparator}</TableCell>
                  <TableCell>{rule.thresholdValue}</TableCell>
                  <TableCell>{rule.windowDays}</TableCell>
                  <TableCell className="text-muted-foreground" title={rule.recipientEmails.join(', ')}>
                    {formatRecipients(rule.recipientEmails)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? 'success' : 'secondary'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <AlertRuleDialog rule={rule} />
                      <DeleteAlertRuleDialog publicId={rule.publicId} label={METRIC_LABELS[rule.metricCode] ?? rule.metricCode} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

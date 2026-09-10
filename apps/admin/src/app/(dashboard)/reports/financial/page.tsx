import { apiGet, buildQuery } from '@/lib/api-client';
import type {
  SalesDailyRow,
  PaymentMethodRow,
  ReturnDailyRow,
  TaxBreakdownRow,
  StoredValueLiabilityRow,
  CreditAccountSummaryRow,
} from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, formatMoney } from '@/components/reports/stat-card';
import { TrendLineChart } from '@/components/reports/charts/trend-line-chart';
import { BarChartPanel } from '@/components/reports/charts/bar-chart-panel';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from '../date-range';
import { DateRangeFilter } from '../date-range-filter';

interface ReportSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Financial Analytics (plan/19 §6.x) — same shape as Sales/Inventory: resolve
 * the date range once, fetch everything in parallel, reduce into KPI numbers,
 * then charts + detail tables. Two of the six fetches (stored-value-liability,
 * credit-accounts) are LIVE "right now" snapshots with no date params at all —
 * mirrors the Inventory page's low-stock section exactly, including the
 * "Live snapshot as of now" CardDescription convention.
 *
 * This is NOT a P&L/margin report — see the intro paragraph below. There is
 * no product-cost/COGS data anywhere in this system yet, so "profit" can't be
 * computed; this page covers tax, payment mix, refunds, and outstanding
 * liability instead, all of which the backend actually has data for.
 */
export default async function FinancialReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const [sales, paymentMethods, returns, taxBreakdown, storedValueLiability, creditAccounts] = await Promise.all([
    apiGet<SalesDailyRow[]>(`/admin/v1/analytics/sales${query}`),
    apiGet<PaymentMethodRow[]>(`/admin/v1/analytics/payment-methods${query}`),
    apiGet<ReturnDailyRow[]>(`/admin/v1/analytics/returns${query}`),
    apiGet<TaxBreakdownRow[]>(`/admin/v1/analytics/financial/tax-breakdown${query}`),
    // Live snapshots — no dateFrom/dateTo, not affected by the range above.
    apiGet<StoredValueLiabilityRow[]>('/admin/v1/analytics/financial/stored-value-liability'),
    apiGet<CreditAccountSummaryRow[]>('/admin/v1/analytics/financial/credit-accounts'),
  ]);

  // KPI row — net revenue / refund total summed across whatever currencies
  // exist in range, same MVP simplification as the Sales page's own reduce
  // (see that page's header comment). Tax collected, by contrast, is grouped
  // by currency below and rendered as one tile per currency — amounts in
  // different currencies must never be summed together.
  const netRevenue = sales.reduce((sum, r) => sum + Number(r.netRevenue), 0);
  const refundTotal = sales.reduce((sum, r) => sum + Number(r.refundTotal), 0);

  const taxByCurrency = new Map<string, { rows: TaxBreakdownRow[]; total: number }>();
  for (const r of taxBreakdown) {
    const acc = taxByCurrency.get(r.currency) ?? { rows: [], total: 0 };
    acc.rows.push(r);
    acc.total += Number(r.amount);
    taxByCurrency.set(r.currency, acc);
  }
  const taxCurrencies = [...taxByCurrency.keys()].sort();

  // Payment method mix — PaymentMethodRow carries no currency field at all
  // (documented limitation of this endpoint today), so amounts are rendered
  // as-is with no currency grouping/labeling.
  const paymentMethodChartData = paymentMethods.map((r) => ({
    label: `${r.method} (${r.gateway})`,
    value: Number(r.successAmount),
  }));

  // Refunds/returns trend — one point per calendar day, sorted ascending.
  const sortedReturns = [...returns].sort((a, b) => a.dateKey - b.dateKey);
  const returnsTrendData = sortedReturns.map((r) => ({ x: formatDateKey(r.dateKey), returnAmount: Number(r.returnAmount) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Financial Analytics</h1>
        <DateRangeFilter basePath="/reports/financial" current={range} />
      </div>

      <p className="max-w-3xl text-sm text-muted-foreground">
        This page is not a profit &amp; loss or margin report — this system has no product-cost/COGS data yet, so true
        profitability can&apos;t be computed. What it does cover, with real data: tax collected, payment method mix, refunds
        and returns, and outstanding stored-value and credit liability.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Net revenue" value={formatMoney(netRevenue.toString())} />
        <StatCard label="Refund total" value={formatMoney(refundTotal.toString())} />
        {taxCurrencies.length > 0 ? (
          taxCurrencies.map((currency) => (
            <StatCard
              key={currency}
              label={taxCurrencies.length > 1 ? `Tax collected (${currency})` : 'Tax collected'}
              value={formatMoney(taxByCurrency.get(currency)!.total.toString())}
            />
          ))
        ) : (
          <StatCard label="Tax collected" value={formatMoney('0')} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stored-value liability</CardTitle>
            <CardDescription>Live snapshot as of now — not affected by the date range above.</CardDescription>
          </CardHeader>
          <CardContent>
            {storedValueLiability.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Gift card outstanding</TableHead>
                    <TableHead className="text-right">Wallet outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storedValueLiability.map((row) => (
                    <TableRow key={row.currency}>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.giftCardOutstanding)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.walletOutstanding)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No liability recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding receivables</CardTitle>
            <CardDescription>Live snapshot as of now — not affected by the date range above.</CardDescription>
          </CardHeader>
          <CardContent>
            {creditAccounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Accounts</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Credit limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditAccounts.map((row) => (
                    <TableRow key={row.currency}>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell className="text-right">{row.accountCount}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.totalOutstanding)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.totalCreditLimit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No credit accounts recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment method mix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {paymentMethodChartData.length > 0 ? (
            <BarChartPanel data={paymentMethodChartData} orientation="bars" format="money" />
          ) : (
            <ChartEmptyState />
          )}
          {paymentMethods.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead className="text-right">Succeeded</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Succeeded amount</TableHead>
                  <TableHead className="text-right">Refunded amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods.map((row, i) => (
                  <TableRow key={`${row.method}-${row.gateway}-${i}`}>
                    <TableCell>{row.method}</TableCell>
                    <TableCell>{row.gateway}</TableCell>
                    <TableCell className="text-right">{row.successCount}</TableCell>
                    <TableCell className="text-right">{row.failedCount}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.successAmount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.refundedAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No payment activity in this date range.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refunds &amp; returns trend</CardTitle>
        </CardHeader>
        <CardContent>
          {returnsTrendData.length > 0 ? (
            <TrendLineChart
              data={returnsTrendData}
              series={[{ key: 'returnAmount', label: 'Return amount', colorVar: 'var(--chart-1)' }]}
              format="money"
            />
          ) : (
            <ChartEmptyState />
          )}
        </CardContent>
      </Card>

      {taxCurrencies.length > 0 ? (
        taxCurrencies.map((currency) => {
          const { rows } = taxByCurrency.get(currency)!;
          const chartData = taxChartData(rows);
          return (
            <Card key={currency}>
              <CardHeader>
                <CardTitle>Tax breakdown (GST) — {currency}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {chartData.length > 0 ? <BarChartPanel data={chartData} format="money" /> : <ChartEmptyState />}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tax type</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow key={`${row.taxType ?? 'other'}-${row.currency}-${i}`}>
                        <TableCell>{row.taxType ?? 'Other/Unclassified'}</TableCell>
                        <TableCell>{row.currency}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tax breakdown (GST)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-8 text-center text-sm text-muted-foreground">No tax collected in this date range.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function taxChartData(rows: TaxBreakdownRow[]): Array<{ label: string; value: number }> {
  const byType = new Map<string, number>();
  for (const r of rows) {
    const label = r.taxType ?? 'Other/Unclassified';
    byType.set(label, (byType.get(label) ?? 0) + Number(r.amount));
  }
  return [...byType.entries()].map(([label, value]) => ({ label, value }));
}

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

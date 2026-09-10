'use client';

import { useActionState, useMemo, useState } from 'react';
import { runReport, createSavedReport, deleteSavedReport, type ActionState } from './actions';
import { dateRangePresets } from '../date-range';
import type { ReportMetricDefinition, ReportResult, SavedReportView, ReportMetricCategory } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// A local copy of components/ui select styling used elsewhere for a plain
// native <select> (see automation/rule-form-dialog.tsx's own comment) —
// lighter than the full Select component for a single grouped dropdown.
const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const initialActionState: ActionState = { error: null, success: false };

type BuiltinRangePreset = 'last_7_days' | 'last_30_days' | 'this_month';

/** Maps date-range.ts's own preset labels to the saved-report API's fixed
 *  rangePreset vocabulary. "Today" and "Last 90 days" have no equivalent in
 *  that vocabulary, so a saved report built from either preset falls back
 *  to 'custom' with the real dates baked in — still correct, just not
 *  re-resolved to a moving window on re-run. */
const LABEL_TO_RANGE_PRESET: Record<string, BuiltinRangePreset> = {
  'Last 7 days': 'last_7_days',
  'Last 30 days': 'last_30_days',
  'Month to date': 'this_month',
};

const RANGE_PRESET_TO_LABEL: Record<BuiltinRangePreset, string> = {
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  this_month: 'Month to date',
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateKeyToIso(key: number): string {
  const s = String(key);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function isoToDateKey(iso: string): number {
  return Number(iso.replaceAll('-', ''));
}

/** Re-resolves a saved report's range back to a real dateFrom/dateTo —
 *  last_7_days/last_30_days/this_month always mean the CURRENT window as of
 *  today (matching the backend's own design), never whatever the range was
 *  on the day it was saved. Only 'custom' replays fixed dates. */
function resolveSavedRange(saved: SavedReportView): { dateFrom: string; dateTo: string } {
  if (saved.rangePreset === 'custom') {
    const today = toDateOnly(new Date());
    return {
      dateFrom: saved.customFromDateKey ? dateKeyToIso(saved.customFromDateKey) : today,
      dateTo: saved.customToDateKey ? dateKeyToIso(saved.customToDateKey) : today,
    };
  }
  const label = RANGE_PRESET_TO_LABEL[saved.rangePreset];
  const preset = dateRangePresets().find((p) => p.label === label);
  if (preset) return { dateFrom: preset.dateFrom, dateTo: preset.dateTo };
  const today = toDateOnly(new Date());
  return { dateFrom: today, dateTo: today };
}

function describeSavedRange(saved: SavedReportView): string {
  if (saved.rangePreset === 'custom') {
    return saved.customFromDateKey && saved.customToDateKey
      ? `${dateKeyToIso(saved.customFromDateKey)} – ${dateKeyToIso(saved.customToDateKey)} (custom)`
      : 'Custom range';
  }
  return RANGE_PRESET_TO_LABEL[saved.rangePreset];
}

// A local copy of lib/api-client.ts's buildQuery — that module pulls in
// session.ts ('server-only'), which can't be imported from a Client
// Component at all (see date-range-filter.tsx's own comment for the same
// reasoning).
function buildQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function formatCell(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

/** True only when every row actually has a numeric value for this column —
 *  the nice-to-have right-alignment the spec calls out, skipped rather than
 *  guessed at when there's no data to check. */
function isNumericColumn(result: ReportResult, key: string): boolean {
  return result.rows.length > 0 && result.rows.every((row) => typeof row[key] === 'number');
}

function DeleteSavedReportButton({ publicId }: { publicId: string }) {
  const [state, formAction, pending] = useActionState(deleteSavedReport, initialActionState);
  return (
    <form action={formAction}>
      <input type="hidden" name="publicId" value={publicId} />
      <Button type="submit" variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={pending}>
        {pending ? 'Deleting…' : 'Delete'}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function ReportBuilderClient({ metrics, savedReports }: { metrics: ReportMetricDefinition[]; savedReports: SavedReportView[] }) {
  const presets = useMemo(() => dateRangePresets(), []);
  const defaultPreset = presets.find((p) => p.label === 'Last 30 days') ?? presets[0];

  const [metricCode, setMetricCode] = useState<string>(metrics[0]?.code ?? '');
  const [dateFrom, setDateFrom] = useState<string>(defaultPreset?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState<string>(defaultPreset?.dateTo ?? '');
  const [limit, setLimit] = useState<number>(20);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [saveState, saveFormAction, savePending] = useActionState(createSavedReport, initialActionState);
  const [handledSaveState, setHandledSaveState] = useState(saveState);
  if (saveState !== handledSaveState) {
    setHandledSaveState(saveState);
    if (saveState.success) {
      setSaveOpen(false);
      setReportName('');
    }
  }

  const metricsByCategory = useMemo(() => {
    const map = new Map<ReportMetricCategory, ReportMetricDefinition[]>();
    for (const m of metrics) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return map;
  }, [metrics]);

  const selectedMetric = metrics.find((m) => m.code === metricCode);
  const activePreset = presets.find((p) => p.dateFrom === dateFrom && p.dateTo === dateTo);
  const rangePreset: BuiltinRangePreset | 'custom' = (activePreset && LABEL_TO_RANGE_PRESET[activePreset.label]) || 'custom';
  const exportHref = '/api/reports/export' + buildQueryString({ metricCode, dateFrom, dateTo, limit });

  async function runMetricReport(mCode: string, dFrom: string, dTo: string, lim: number) {
    setPending(true);
    setError(null);
    const res = await runReport(mCode, dFrom, dTo, lim);
    setPending(false);
    if (res.error) {
      setError(res.error);
      setResult(null);
      return;
    }
    setResult(res.result);
  }

  async function handleRunClick() {
    await runMetricReport(metricCode, dateFrom, dateTo, limit);
  }

  async function handleRunSaved(saved: SavedReportView) {
    const range = resolveSavedRange(saved);
    setMetricCode(saved.metricCode);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    await runMetricReport(saved.metricCode, range.dateFrom, range.dateTo, limit);
  }

  if (metrics.length === 0) {
    return <p className="text-sm text-muted-foreground">No reportable metrics are registered.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="report-metric">Metric</Label>
            <select
              id="report-metric"
              className={cn(nativeSelectClass, 'w-full')}
              value={metricCode}
              onChange={(e) => {
                setMetricCode(e.target.value);
                setResult(null);
                setError(null);
              }}
            >
              {[...metricsByCategory.entries()].map(([category, list]) => (
                <optgroup key={category} label={category}>
                  {list.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedMetric ? <p className="text-xs text-muted-foreground">{selectedMetric.description}</p> : null}
          </div>

          {selectedMetric?.hasLimit ? (
            <div className="space-y-2">
              <Label htmlFor="report-limit">Rows</Label>
              <Input
                id="report-limit"
                type="number"
                min={1}
                step={1}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
                className="w-28"
              />
              <p className="text-xs text-muted-foreground">Top-N — how many rows to return.</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <Label>Date range</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((p) => {
              const active = p.dateFrom === dateFrom && p.dateTo === dateTo;
              return (
                <Button
                  key={p.label}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setDateFrom(p.dateFrom);
                    setDateTo(p.dateTo);
                  }}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <div>
              <Label htmlFor="report-date-from" className="text-xs font-normal text-muted-foreground">
                From
              </Label>
              <Input id="report-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="report-date-to" className="text-xs font-normal text-muted-foreground">
                To
              </Label>
              <Input id="report-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="button" onClick={() => void handleRunClick()} disabled={pending || !metricCode}>
            {pending ? 'Running…' : 'Run Report'}
          </Button>
          <a href={exportHref} className={cn(buttonVariants({ variant: 'outline' }))}>
            Export CSV
          </a>
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger
              render={
                <Button type="button" variant="outline" disabled={!metricCode}>
                  Save This Report
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Report</DialogTitle>
                <DialogDescription>Re-run it later from the Saved Reports list below.</DialogDescription>
              </DialogHeader>
              <form action={saveFormAction} className="space-y-4">
                <input type="hidden" name="metricCode" value={metricCode} />
                <input type="hidden" name="rangePreset" value={rangePreset} />
                {rangePreset === 'custom' ? (
                  <>
                    <input type="hidden" name="customFromDateKey" value={isoToDateKey(dateFrom)} />
                    <input type="hidden" name="customToDateKey" value={isoToDateKey(dateTo)} />
                  </>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="report-save-name">Name</Label>
                  <Input
                    id="report-save-name"
                    name="name"
                    required
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="e.g. Weekly sales summary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Metric: {selectedMetric?.label ?? metricCode} · Range: {activePreset ? activePreset.label : `${dateFrom} – ${dateTo} (custom)`}
                </p>
                {saveState.error ? <p className="text-sm text-destructive">{saveState.error}</p> : null}
                <DialogFooter>
                  <Button type="submit" disabled={savePending}>
                    {savePending ? 'Saving…' : 'Save Report'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>

      {result ? (
        <div className="rounded-md border">
          <div className="border-b p-3">
            <p className="font-medium">{result.metricLabel}</p>
            <p className="text-xs text-muted-foreground">
              {dateFrom} – {dateTo}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {result.columns.map((c) => (
                  <TableHead key={c.key} className={isNumericColumn(result, c.key) ? 'text-right' : undefined}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={result.columns.length || 1} className="text-center text-muted-foreground">
                    No data for this metric/date range.
                  </TableCell>
                </TableRow>
              ) : (
                result.rows.map((row, i) => (
                  <TableRow key={i}>
                    {result.columns.map((c) => (
                      <TableCell key={c.key} className={isNumericColumn(result, c.key) ? 'text-right' : undefined}>
                        {formatCell(row[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold">Saved Reports</h2>
        <div className="mt-3 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Range</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savedReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No saved reports yet.
                  </TableCell>
                </TableRow>
              ) : (
                savedReports.map((saved) => (
                  <TableRow key={saved.publicId}>
                    <TableCell className="font-medium">{saved.name}</TableCell>
                    <TableCell className="text-muted-foreground">{saved.metricLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{describeSavedRange(saved)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void handleRunSaved(saved)}>
                          Run
                        </Button>
                        <DeleteSavedReportButton publicId={saved.publicId} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

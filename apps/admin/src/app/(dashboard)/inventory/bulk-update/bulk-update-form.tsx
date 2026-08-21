'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FileUploadButton } from '@/components/ui/file-upload-button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { submitBulkSetStock, getBulkStockJobStatus, type BulkStockRowInput } from '../actions';
import type { Warehouse, BulkJobStatus } from '@/lib/types';

interface ParseError {
  line: number;
  message: string;
}

const TEMPLATE_CSV = 'sku,quantity\nDEMO-SKU-1,25\nDEMO-SKU-2,0\n';

/**
 * Minimal comma-split CSV parser — no quoted-comma/multiline-field support,
 * matching this app's existing bulk-import scope (JSON-body rows on the
 * backend, not a real RFC 4180 parser). A header row is optional: detected
 * by checking whether the first row's second column parses as a number —
 * if it doesn't, row 1 is treated as a header and skipped.
 */
function parseCsv(text: string): { rows: BulkStockRowInput[]; errors: ParseError[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rows: BulkStockRowInput[] = [];
  const errors: ParseError[] = [];
  if (lines.length === 0) return { rows, errors };

  let startIndex = 0;
  const first = lines[0]!.split(',').map((c) => c.trim());
  if (first.length >= 2 && Number.isNaN(Number(first[1]))) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const lineNo = i + 1;
    const sku = cols[0];
    const qtyRaw = cols[1];
    if (!sku || qtyRaw === undefined || qtyRaw === '') {
      errors.push({ line: lineNo, message: 'Expected two columns: sku,quantity' });
      continue;
    }
    const quantity = Number(qtyRaw);
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push({ line: lineNo, message: `Invalid quantity "${qtyRaw}" for SKU "${sku}"` });
      continue;
    }
    rows.push({ sku, quantity });
  }

  return { rows, errors };
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-stock-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkUpdateStockForm({ warehouses }: { warehouses: Warehouse[] }) {
  const [warehouseCode, setWarehouseCode] = useState<string | null>(warehouses[0]?.code ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkStockRowInput[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<BulkJobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Stop polling if the page navigates away mid-import.
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSubmitError(null);
    setJobId(null);
    setJobStatus(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''));
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    };
    reader.readAsText(file);
  }

  function poll(id: string) {
    pollTimer.current = setTimeout(async () => {
      const status = await getBulkStockJobStatus(id);
      setJobStatus(status);
      if (status.status === 'completed' || status.status === 'failed') {
        setSubmitting(false);
        return;
      }
      poll(id);
    }, 1000);
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!warehouseCode) {
      setSubmitError('Select a warehouse.');
      return;
    }
    if (rows.length === 0) {
      setSubmitError('Choose a CSV file with sku,quantity rows first.');
      return;
    }
    setSubmitting(true);
    setJobStatus(null);
    const result = await submitBulkSetStock(warehouseCode, rows);
    if (result.error || !result.jobId) {
      setSubmitError(result.error ?? 'Something went wrong.');
      setSubmitting(false);
      return;
    }
    setJobId(result.jobId);
    poll(result.jobId);
  }

  function reset() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setFileName(null);
    setRows([]);
    setParseErrors([]);
    setSubmitError(null);
    setJobId(null);
    setJobStatus(null);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const progress = typeof jobStatus?.progress === 'number' ? jobStatus.progress : 0;
  const done = jobStatus?.status === 'completed' || jobStatus?.status === 'failed';
  const selectedWarehouse = warehouses.find((w) => w.code === warehouseCode) ?? null;

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a warehouse</CardTitle>
          <CardDescription>Every row in the CSV sets that SKU&apos;s on-hand quantity at this one warehouse.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="warehouseCode">Warehouse</Label>
            <Select value={warehouseCode} onValueChange={setWarehouseCode} disabled={submitting}>
              <SelectTrigger id="warehouseCode" className="w-full">
                <SelectValue placeholder="Select a warehouse">
                  {() => (selectedWarehouse ? `${selectedWarehouse.name} (${selectedWarehouse.code})` : 'Select a warehouse')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.code} value={w.code}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Upload a CSV</CardTitle>
          <CardDescription>
            Two columns: <code className="rounded bg-muted px-1 py-0.5">sku,quantity</code>. Quantity is the new on-hand
            total, not a change amount — a row for a SKU already at that quantity is a harmless no-op.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <FileUploadButton
              ref={fileInputRef}
              label={fileName ?? 'Choose CSV'}
              accept=".csv,text/csv"
              onChange={handleFile}
              disabled={submitting}
            />
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
              Download template
            </Button>
            {fileName ? (
              <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={submitting}>
                Clear
              </Button>
            ) : null}
          </div>

          {parseErrors.length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <p className="font-medium">{parseErrors.length} row(s) skipped:</p>
              <ul className="mt-1 list-inside list-disc">
                {parseErrors.slice(0, 10).map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
                {parseErrors.length > 10 ? <li>…and {parseErrors.length - 10} more</li> : null}
              </ul>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">{rows.length} row(s) ready to import.</p>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>New Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={`${r.sku}-${i}`}>
                        <TableCell className="font-medium">{r.sku}</TableCell>
                        <TableCell>{r.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 50 ? (
                <p className="mt-1 text-xs text-muted-foreground">Showing first 50 of {rows.length} rows.</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      {jobId && jobStatus ? (
        <Card>
          <CardHeader>
            <CardTitle>{done ? 'Import complete' : 'Importing…'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!done ? (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            ) : null}
            {jobStatus.result ? (
              <div className="text-sm">
                <p>
                  <span className="font-medium text-foreground">{jobStatus.result.succeeded}</span> succeeded,{' '}
                  <span className="font-medium text-foreground">{jobStatus.result.failed}</span> failed, out of{' '}
                  {jobStatus.result.total} row(s).
                </p>
                {jobStatus.result.errors.length > 0 ? (
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobStatus.result.errors.map((e) => (
                          <TableRow key={e.row}>
                            <TableCell>{e.row + 1}</TableCell>
                            <TableCell className="font-medium">{e.sku}</TableCell>
                            <TableCell className="text-destructive">{e.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            ) : jobStatus.status === 'failed' ? (
              <p className="text-sm text-destructive">{jobStatus.error ?? 'The job failed.'}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={handleSubmit} disabled={submitting || rows.length === 0}>
          {submitting ? 'Importing…' : `Import ${rows.length || ''} row(s)`.trim()}
        </Button>
        {done ? (
          <Button type="button" variant="outline" onClick={reset}>
            Import another file
          </Button>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FileUploadButton } from '@/components/ui/file-upload-button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  submitBulkUpsertProducts,
  getBulkProductJobStatus,
  type BulkProductRowInput,
} from '../actions';
import type { AttributeSet, PriceList, Warehouse, BulkJobStatus, BulkProductImportResult } from '@/lib/types';

interface ParseError {
  line: number;
  message: string;
}

// Columns with a fixed meaning — anything else in the header row is treated
// as an attribute code (see the worker's parseAttributeCell for how each
// cell gets typed). "name" is the CSV-friendly alias for nameDefault.
const RESERVED_HEADERS = new Set([
  'sku',
  'type',
  'attributesetcode',
  'name',
  'status',
  'visibility',
  'weight',
  'price',
  'mrp',
  'qty',
  'categories',
]);

const TEMPLATE_CSV = [
  'sku,type,attributeSetCode,name,status,visibility,price,mrp,qty,categories,color',
  'DEMO-NEW-SKU-1,SIMPLE,accessories,"Example New Product",ACTIVE,BOTH,499.00,599.00,25,phones,Red',
  'DEMO-EXISTING-SKU,,,"Renamed product (leave type/attributeSetCode blank to just update)",,,,,,,',
].join('\n');

/**
 * A real (if line-oriented — no embedded-newline-in-a-cell support) CSV
 * parser: quoted fields, embedded commas, and doubled `""` escaping all
 * work, unlike the plain comma-split used for the 2-column stock CSV —
 * product names routinely contain commas ("Men's Jacket, Blue"), so this
 * one needs to be a step more correct.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseProductCsv(text: string): { rows: BulkProductRowInput[]; errors: ParseError[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: ParseError[] = [];
  if (lines.length === 0) return { rows: [], errors: [{ line: 1, message: 'The file is empty.' }] };

  const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  if (!lowerHeaders.includes('sku')) {
    return { rows: [], errors: [{ line: 1, message: 'The CSV must have a "sku" column in its header row.' }] };
  }
  const categoriesIdx = lowerHeaders.indexOf('categories');

  const rows: BulkProductRowInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const lineNo = i + 1;
    const get = (name: string): string | undefined => {
      const idx = lowerHeaders.indexOf(name);
      if (idx === -1) return undefined;
      const v = cells[idx];
      return v === undefined || v === '' ? undefined : v;
    };

    const sku = get('sku');
    if (!sku) {
      errors.push({ line: lineNo, message: 'Missing sku.' });
      continue;
    }

    let qty: number | undefined;
    const qtyRaw = get('qty');
    if (qtyRaw !== undefined) {
      qty = Number(qtyRaw);
      if (!Number.isInteger(qty) || qty < 0) {
        errors.push({ line: lineNo, message: `Invalid qty "${qtyRaw}".` });
        continue;
      }
    }

    let categorySlugs: string[] | undefined;
    if (categoriesIdx !== -1) {
      const cell = (cells[categoriesIdx] ?? '').trim();
      categorySlugs = cell === '' ? [] : cell.split('|').map((s) => s.trim()).filter(Boolean);
    }

    const attributes: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const key = h.toLowerCase();
      if (h && !RESERVED_HEADERS.has(key)) {
        const v = cells[idx];
        if (v !== undefined && v.trim() !== '') attributes[h] = v.trim();
      }
    });

    rows.push({
      sku,
      type: get('type'),
      attributeSetCode: get('attributesetcode'),
      nameDefault: get('name') ?? null,
      status: get('status'),
      visibility: get('visibility'),
      weight: get('weight') ?? null,
      price: get('price') ?? null,
      mrp: get('mrp') ?? null,
      qty,
      categorySlugs,
      attributes: Object.keys(attributes).length ? attributes : undefined,
    });
  }

  return { rows, errors };
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductImportForm({
  attributeSets,
  priceLists,
  warehouses,
}: {
  attributeSets: AttributeSet[];
  priceLists: PriceList[];
  warehouses: Warehouse[];
}) {
  const [priceListCode, setPriceListCode] = useState<string | null>(null);
  const [warehouseCode, setWarehouseCode] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkProductRowInput[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<BulkJobStatus<BulkProductImportResult> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
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
      const parsed = parseProductCsv(String(reader.result ?? ''));
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    };
    reader.readAsText(file);
  }

  function poll(id: string) {
    pollTimer.current = setTimeout(async () => {
      const status = await getBulkProductJobStatus(id);
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
    if (rows.length === 0) {
      setSubmitError('Choose a CSV file with at least one product row first.');
      return;
    }
    setSubmitting(true);
    setJobStatus(null);
    const result = await submitBulkUpsertProducts(priceListCode, warehouseCode, rows);
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
  const selectedPriceList = priceLists.find((p) => p.code === priceListCode) ?? null;
  const selectedWarehouse = warehouses.find((w) => w.code === warehouseCode) ?? null;
  const hasPriceRows = rows.some((r) => r.price != null);
  const hasQtyRows = rows.some((r) => r.qty != null);

  return (
    <div className="mt-6 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Optional: price list &amp; warehouse</CardTitle>
          <CardDescription>
            Only needed if your CSV has a <code className="rounded bg-muted px-1 py-0.5">price</code>/
            <code className="rounded bg-muted px-1 py-0.5">mrp</code> or{' '}
            <code className="rounded bg-muted px-1 py-0.5">qty</code> column — leave a selector on
            &quot;Don&apos;t import&quot; and that column is ignored.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="priceListCode">Price list</Label>
            <Select value={priceListCode} onValueChange={setPriceListCode} disabled={submitting}>
              <SelectTrigger id="priceListCode" className="w-full">
                <SelectValue placeholder="Don't import prices">
                  {() => (selectedPriceList ? `${selectedPriceList.name} (${selectedPriceList.code})` : "Don't import prices")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {priceLists.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name} ({p.code}) — {p.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="warehouseCode">Warehouse</Label>
            <Select value={warehouseCode} onValueChange={setWarehouseCode} disabled={submitting}>
              <SelectTrigger id="warehouseCode" className="w-full">
                <SelectValue placeholder="Don't import stock">
                  {() => (selectedWarehouse ? `${selectedWarehouse.name} (${selectedWarehouse.code})` : "Don't import stock")}
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
          <CardDescription className="space-y-1">
            <span className="block">
              Required column: <code className="rounded bg-muted px-1 py-0.5">sku</code> — a known SKU updates that
              product, an unknown one creates it (needs <code className="rounded bg-muted px-1 py-0.5">type</code>{' '}
              and <code className="rounded bg-muted px-1 py-0.5">attributeSetCode</code> too).
            </span>
            <span className="block">
              Recognized columns: type, attributeSetCode, name, status, visibility, weight, price, mrp, qty,
              categories (pipe-separated slugs, e.g. <code className="rounded bg-muted px-1 py-0.5">phones|laptops</code>
              ). Any other column header is treated as a product attribute code — for a dropdown/multi-select
              attribute, type the option&apos;s label (multi-select: pipe-separated labels).
            </span>
            <span className="block">
              Configurable/bundle products aren&apos;t supported by CSV import — create simple, digital, or virtual
              products this way.
            </span>
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

          {attributeSets.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Known attribute set codes: {attributeSets.map((s) => s.code).join(', ')}
            </p>
          ) : null}

          {hasPriceRows && !priceListCode ? (
            <p className="text-sm text-destructive">
              Some rows have a price/mrp but no price list is selected above — those rows will fail.
            </p>
          ) : null}
          {hasQtyRows && !warehouseCode ? (
            <p className="text-sm text-destructive">
              Some rows have a qty but no warehouse is selected above — those rows will fail.
            </p>
          ) : null}

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
              <div className="mt-2 max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Attributes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={`${r.sku}-${i}`}>
                        <TableCell className="font-medium">{r.sku}</TableCell>
                        <TableCell>{r.type ?? '—'}</TableCell>
                        <TableCell>{r.nameDefault ?? '—'}</TableCell>
                        <TableCell>{r.price ?? '—'}</TableCell>
                        <TableCell>{r.qty ?? '—'}</TableCell>
                        <TableCell>{r.categorySlugs?.join(', ') || '—'}</TableCell>
                        <TableCell>{r.attributes ? Object.keys(r.attributes).join(', ') : '—'}</TableCell>
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
                  <span className="font-medium text-foreground">{jobStatus.result.created}</span> created,{' '}
                  <span className="font-medium text-foreground">{jobStatus.result.updated}</span> updated,{' '}
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

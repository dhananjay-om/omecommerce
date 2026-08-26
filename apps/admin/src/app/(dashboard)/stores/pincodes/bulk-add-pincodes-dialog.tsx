'use client';

import { useState, useTransition } from 'react';
import { bulkAddPincodes, type BulkAddRow } from './actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const PLACEHOLDER = `110001,New Delhi,Delhi,3,true
400001,Mumbai,Maharashtra,4,true
560001,Bengaluru,Karnataka,5,false`;

/** Parses "code,city,state,estimatedDays,codAvailable" lines, one per
 *  pincode. codAvailable accepts true/false/yes/no/1/0, defaults to true
 *  when omitted (matching the single-add form's own default). Rows that
 *  don't parse are dropped and reported back, not silently skipped. */
function parseCsv(text: string): { rows: BulkAddRow[]; invalidLines: number } {
  const rows: BulkAddRow[] = [];
  let invalidLines = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim());
    const [code, city, state, daysStr, codStr] = parts;
    const estimatedDays = Number(daysStr);
    if (!/^\d{6}$/.test(code ?? '') || !city || !state || !Number.isFinite(estimatedDays)) {
      invalidLines++;
      continue;
    }
    const codAvailable = codStr === undefined || codStr === '' ? true : ['true', 'yes', '1'].includes(codStr.toLowerCase());
    rows.push({ code, city, state, estimatedDays, codAvailable });
  }
  return { rows, invalidLines };
}

export function BulkAddPincodesDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ total: number; created: number; updated: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setResult(null);
    const { rows, invalidLines } = parseCsv(text);
    if (rows.length === 0) {
      setError(invalidLines > 0 ? `None of the ${invalidLines} line(s) parsed — check the format.` : 'Paste at least one row first.');
      return;
    }
    startTransition(async () => {
      const res = await bulkAddPincodes(rows);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult(res.result);
      if (invalidLines > 0) {
        setError(`${invalidLines} line(s) were skipped for not matching the format.`);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setText('');
          setError(null);
          setResult(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline">Bulk Add</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Add Pincodes</DialogTitle>
          <DialogDescription>
            One pincode per line: <code>code,city,state,estimatedDays,codAvailable</code>. An existing code is
            updated in place, not duplicated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-pin-csv">CSV rows</Label>
            <Textarea
              id="bulk-pin-csv"
              rows={8}
              placeholder={PLACEHOLDER}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {result ? (
            <p className="text-sm text-muted-foreground">
              Done — {result.created} created, {result.updated} updated ({result.total} total).
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? 'Adding…' : 'Add Pincodes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

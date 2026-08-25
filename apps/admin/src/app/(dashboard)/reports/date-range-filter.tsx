'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { dateRangePresets, type ResolvedDateRange } from './date-range';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// A local copy of lib/api-client.ts's buildQuery — that module pulls in
// session.ts ('server-only'), which can't be imported from a Client
// Component at all (build-time error), so this pure query-string helper
// isn't reusable as-is from here. Trivial enough to just duplicate.
function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Shared date-range filter for every /reports/* page and the Dashboard —
 *  was a row of preset buttons + 2 date inputs + an Apply button sitting
 *  inline in the filter bar; now the same controls live behind one
 *  trigger, matching the "More filters" popover convention used elsewhere
 *  this session (orders/more-filters-popover.tsx et al) instead of taking
 *  up a full row of horizontal space. Still a plain GET navigation under
 *  the hood (no client-side data fetching) — the only client-side state
 *  is the popover's own open/closed. `basePath` is the current page's own
 *  route (e.g. "/reports/sales") so presets/submit stay on the same page. */
export function DateRangeFilter({ basePath, current }: { basePath: string; current: ResolvedDateRange }) {
  const [open, setOpen] = useState(false);
  const presets = dateRangePresets();
  const activePreset = presets.find((p) => p.dateFrom === current.dateFrom && p.dateTo === current.dateTo);
  const triggerLabel = activePreset ? activePreset.label : `${formatDate(current.dateFrom)} – ${formatDate(current.dateTo)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Calendar className="size-3.5" />
            {triggerLabel}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-0.5">
          {presets.map((p) => {
            const active = p.dateFrom === current.dateFrom && p.dateTo === current.dateTo;
            return (
              <Link
                key={p.label}
                href={`${basePath}${buildQuery({ dateFrom: p.dateFrom, dateTo: p.dateTo })}`}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-muted',
                  active && 'bg-primary/10 font-medium text-primary',
                )}
              >
                {p.label}
                {active ? <Check className="size-3.5" /> : null}
              </Link>
            );
          })}
        </div>
        <div className="mt-2 border-t pt-3">
          <p className="px-0.5 pb-2 text-xs font-medium text-muted-foreground">Custom range</p>
          {/* Stacked, full-width rows — a date input's calendar-icon +
              day/month/year segments need more room than a half-width slot
              in a compact popover comfortably gives, especially once the
              year segment is 4 digits. */}
          <form className="space-y-2" action={basePath} onSubmit={() => setOpen(false)}>
            <div>
              <label className="px-0.5 text-xs text-muted-foreground">From</label>
              <Input key={current.dateFrom} type="date" name="dateFrom" defaultValue={current.dateFrom} className="mt-1 w-full" aria-label="From date" />
            </div>
            <div>
              <label className="px-0.5 text-xs text-muted-foreground">To</label>
              <Input key={current.dateTo} type="date" name="dateTo" defaultValue={current.dateTo} className="mt-1 w-full" aria-label="To date" />
            </div>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Apply
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}

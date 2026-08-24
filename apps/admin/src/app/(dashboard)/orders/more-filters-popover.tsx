'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

const FULFILLMENT_STATUSES = ['UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RETURNED'];
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const nativeSelectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * The lower-frequency filters (fulfillment status, date range, page size)
 * live behind one "More filters" trigger — matching the mock's own
 * `.filter-bar` pattern (search + 2 dropdowns + a "More filters" chip)
 * instead of every filter sitting inline, which read as cluttered.
 *
 * These inputs are portaled by the `Popover` primitive (rendered into
 * `document.body`, outside the enclosing `<form>` in the DOM), so plain
 * HTML nesting can't submit them with the form — each one uses the
 * standard HTML `form` attribute instead, which associates an input with
 * a form by id regardless of where it sits in the DOM. `formId` must match
 * the `<form id="...">` this is rendered inside.
 */
export function MoreFiltersPopover({
  formId,
  fulfillmentStatus,
  dateFrom,
  dateTo,
  pageSize,
  activeCount,
}: {
  formId: string;
  fulfillmentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  pageSize: number;
  activeCount: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="size-3.5" />
            More filters
            {activeCount > 0 ? <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-xs text-primary">{activeCount}</span> : null}
          </Button>
        }
      />
      <PopoverContent className="w-72 space-y-3 p-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Fulfillment status</label>
          <select form={formId} name="fulfillmentStatus" defaultValue={fulfillmentStatus ?? ''} className={`${nativeSelectClass} mt-1`}>
            <option value="">All fulfillment statuses</option>
            {FULFILLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">From date</label>
            <Input form={formId} type="date" name="dateFrom" defaultValue={dateFrom} className="mt-1" aria-label="From date" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">To date</label>
            <Input form={formId} type="date" name="dateTo" defaultValue={dateTo} className="mt-1" aria-label="To date" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Rows per page</label>
          <select form={formId} name="pageSize" defaultValue={String(pageSize)} className={`${nativeSelectClass} mt-1`}>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" form={formId} size="sm" className="w-full">
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}

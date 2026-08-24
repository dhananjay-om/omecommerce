'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AttributeSet } from '@/lib/types';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const nativeSelectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * The lower-frequency filters (attribute set, page size) live behind one
 * "More filters" trigger — matches the mock's `.filter-bar` pattern
 * (search + 2 dropdowns + a "More filters" chip) instead of every filter
 * sitting inline. Same portaled-input-via-`form`-attribute technique as
 * the Orders list's `MoreFiltersPopover` — see that file's header comment.
 */
export function MoreFiltersPopover({
  formId,
  attributeSets,
  attributeSetId,
  pageSize,
  activeCount,
}: {
  formId: string;
  attributeSets: AttributeSet[];
  attributeSetId?: string;
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
          <label className="text-xs font-medium text-muted-foreground">Attribute set</label>
          <select form={formId} name="attributeSetId" defaultValue={attributeSetId ?? ''} className={`${nativeSelectClass} mt-1`}>
            <option value="">All attribute sets</option>
            {attributeSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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

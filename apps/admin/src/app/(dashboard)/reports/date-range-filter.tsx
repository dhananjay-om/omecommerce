import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildQuery } from '@/lib/api-client';
import { dateRangePresets, type ResolvedDateRange } from './date-range';

/** Shared date-range filter for every /reports/* page — plain GET form +
 *  preset links, no client JS (same "native date input, full-page
 *  navigation" convention as orders/page.tsx; this app has no reusable
 *  date-range component precedent, so this is the first one, kept as
 *  simple as the existing pattern rather than introducing a client-side
 *  picker library). `basePath` is the current report's own route (e.g.
 *  "/reports/sales") so presets/submit stay on the same page. */
export function DateRangeFilter({ basePath, current }: { basePath: string; current: ResolvedDateRange }) {
  const presets = dateRangePresets();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => {
          const active = p.dateFrom === current.dateFrom && p.dateTo === current.dateTo;
          return (
            <Link
              key={p.label}
              href={`${basePath}${buildQuery({ dateFrom: p.dateFrom, dateTo: p.dateTo })}`}
              className={cn(buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }))}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
      <form className="flex items-center gap-2" action={basePath}>
        <Input key={current.dateFrom} type="date" name="dateFrom" defaultValue={current.dateFrom} className="w-[150px]" aria-label="From date" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input key={current.dateTo} type="date" name="dateTo" defaultValue={current.dateTo} className="w-[150px]" aria-label="To date" />
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>
    </div>
  );
}

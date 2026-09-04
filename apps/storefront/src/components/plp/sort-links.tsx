'use client';

import { useRouter } from 'next/navigation';
import { buildPlpHref, type PlpParams } from '@/lib/plp-query';

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'relevance', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A-Z' },
];

/** Theme reference (`theme/src/pages/ProductListing.tsx`) uses a native
 *  `<select>` for sort, not link pills — ported verbatim (same rounded-full
 *  border + custom chevron background-image), which is why this is a client
 *  component (a `<select>`'s onChange can't cross the server/client
 *  boundary as a plain string the way the sidebar's Link-driven filters do). */
export function SortLinks({ basePath, params }: { basePath: string; params: PlpParams }) {
  const router = useRouter();
  const current = params.sort ?? 'relevance';

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="hidden text-xs text-slate sm:inline">Sort by</span>
      <select
        value={current}
        onChange={(e) => {
          const value = e.target.value;
          router.push(buildPlpHref(basePath, params, { sort: value === 'relevance' ? undefined : value }));
        }}
        aria-label="Sort by"
        className="cursor-pointer appearance-none rounded-full border border-ghost bg-white py-2 pr-8 pl-4 text-xs font-medium text-charcoal outline-none transition-colors hover:border-jet"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23717171' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

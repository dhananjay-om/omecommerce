import Link from 'next/link';
import { buildPlpHref, type PlpParams } from '@/lib/plp-query';

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A-Z' },
];

export function SortLinks({ basePath, params }: { basePath: string; params: PlpParams }) {
  const current = params.sort ?? 'relevance';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate">Sort by</span>
      <div className="flex flex-wrap gap-1">
        {SORT_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={buildPlpHref(basePath, params, { sort: option.value === 'relevance' ? undefined : option.value })}
            className={`rounded-full px-3 py-1 transition-colors ${current === option.value ? 'bg-jet text-white' : 'text-charcoal hover:bg-sand'}`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

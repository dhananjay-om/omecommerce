import Link from 'next/link';
import { CheckIcon, StarIcon } from '@heroicons/react/24/solid';
import type { FacetBucket } from '@/types/product';
import type { Brand } from '@/types/category';
import { buildPlpHref, toggleOverride, type PlpParams } from '@/lib/plp-query';
import { BRAND_FACET_CODE } from '@/lib/facet-codes';

function FilterLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${active ? 'font-semibold text-primary' : ''}`}
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}
      >
        {active ? <CheckIcon className="size-3" /> : null}
      </span>
      <span className="line-clamp-1">{label}</span>
      {count !== undefined ? <span className="ml-auto text-xs text-muted-foreground">{count}</span> : null}
    </Link>
  );
}

export function FilterSidebar({
  basePath,
  params,
  facets,
  brands,
}: {
  basePath: string;
  params: PlpParams;
  facets: Record<string, FacetBucket[]>;
  brands: Brand[];
}) {
  const brandBuckets = facets[BRAND_FACET_CODE] ?? [];
  const brandNameByPublicId = new Map(brands.map((b) => [b.publicId, b.name]));

  const attributeFacetEntries = Object.entries(facets).filter(
    ([code]) => code !== BRAND_FACET_CODE && !code.startsWith('__'),
  );

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 md:w-56">
      {brandBuckets.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Brand</h3>
          <div className="flex flex-col">
            {brandBuckets.map((bucket) => (
              <FilterLink
                key={bucket.value}
                href={buildPlpHref(basePath, params, toggleOverride(params, 'brand', bucket.value))}
                active={params.brand === bucket.value}
                label={brandNameByPublicId.get(bucket.value) ?? bucket.value}
                count={bucket.count}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Price</h3>
        <form action={basePath} className="flex items-center gap-2">
          {Object.entries(params)
            .filter(([key, value]) => key !== 'minPrice' && key !== 'maxPrice' && key !== 'page' && value !== undefined)
            .map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
          <input
            type="number"
            name="minPrice"
            defaultValue={params.minPrice ?? ''}
            placeholder="Min"
            min={0}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            name="maxPrice"
            defaultValue={params.maxPrice ?? ''}
            placeholder="Max"
            min={0}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button type="submit" className="h-8 shrink-0 rounded-lg border px-2.5 text-sm hover:bg-muted">
            Go
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Availability</h3>
        <FilterLink
          href={buildPlpHref(basePath, params, toggleOverride(params, 'inStock', 'true'))}
          active={params.inStock === 'true'}
          label="In Stock Only"
        />
      </div>

      {attributeFacetEntries.map(([code, buckets]) => (
        <div key={code}>
          <h3 className="mb-2 text-sm font-semibold capitalize">{code.replace(/[-_]/g, ' ')}</h3>
          <div className="flex flex-col">
            {buckets.map((bucket) => (
              <FilterLink
                key={bucket.value}
                href={buildPlpHref(basePath, params, toggleOverride(params, code, bucket.value))}
                active={params[code] === bucket.value}
                label={bucket.value}
                count={bucket.count}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
          Rating <span className="text-xs font-normal text-muted-foreground">(coming soon)</span>
        </h3>
        <div className="flex flex-col gap-1 opacity-50">
          {[4, 3, 2, 1].map((stars) => (
            <div key={stars} className="flex items-center gap-1 px-2 py-1 text-sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} className={`size-3.5 ${i < stars ? 'text-cta' : 'text-muted-foreground'}`} />
              ))}
              <span className="ml-1 text-xs text-muted-foreground">& up</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

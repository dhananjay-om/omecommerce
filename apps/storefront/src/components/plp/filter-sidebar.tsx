import Link from 'next/link';
import { CheckIcon, StarIcon } from '@heroicons/react/24/solid';
import type { FacetBucket } from '@/types/product';
import type { Brand } from '@/types/category';
import { buildPlpHref, toggleOverride, type PlpParams } from '@/lib/plp-query';
import { BRAND_FACET_CODE } from '@/lib/facet-codes';
import { PriceRangeSlider } from './price-range-slider';

/** The current category's real "family" for the sidebar Category list —
 *  matches theme's own `ProductListing.tsx` Filters (an "All {parent}" link
 *  + every one of its children, the active one highlighted) — built by the
 *  page from real `listCategories()` data, not a mock. */
export interface CategoryNav {
  parentLabel: string;
  parentHref: string;
  parentActive: boolean;
  items: Array<{ publicId: string; slug: string; label: string; active: boolean }>;
}

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
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sand ${active ? 'font-semibold text-jet' : 'text-charcoal'}`}
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-jet bg-jet text-white' : 'border-ghost'}`}
      >
        {active ? <CheckIcon className="size-3" /> : null}
      </span>
      <span className="line-clamp-1">{label}</span>
      {count !== undefined ? <span className="ml-auto text-xs text-slate">{count}</span> : null}
    </Link>
  );
}

export function FilterSidebar({
  basePath,
  params,
  facets,
  brands,
  categoryNav,
  currency,
}: {
  basePath: string;
  params: PlpParams;
  facets: Record<string, FacetBucket[]>;
  brands: Brand[];
  /** Only collections pages pass this — see CategoryNav's own doc comment. */
  categoryNav?: CategoryNav;
  /** ISO currency code for the price slider's bounds/labels — defaults to
   *  USD (this store's default) when a page has no hits to read it from. */
  currency?: string;
}) {
  const brandBuckets = facets[BRAND_FACET_CODE] ?? [];
  const brandNameByPublicId = new Map(brands.map((b) => [b.publicId, b.name]));

  const attributeFacetEntries = Object.entries(facets).filter(
    ([code]) => code !== BRAND_FACET_CODE && !code.startsWith('__'),
  );

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 md:w-56">
      {categoryNav ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-widest text-jet uppercase">Category</h3>
          <div className="flex flex-col gap-1.5">
            <Link
              href={categoryNav.parentHref}
              className={`py-1 text-sm transition-colors ${categoryNav.parentActive ? 'font-medium text-champagne' : 'text-charcoal hover:text-champagne'}`}
            >
              All {categoryNav.parentLabel}
            </Link>
            {categoryNav.items.map((item) => (
              <Link
                key={item.publicId}
                href={`/collections/${item.slug}`}
                className={`py-1 text-sm transition-colors ${item.active ? 'font-medium text-champagne' : 'text-charcoal hover:text-champagne'}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {brandBuckets.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-widest text-jet uppercase">Brand</h3>
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

      <PriceRangeSlider basePath={basePath} params={params} currency={currency} />

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-widest text-jet uppercase">Availability</h3>
        <FilterLink
          href={buildPlpHref(basePath, params, toggleOverride(params, 'inStock', 'true'))}
          active={params.inStock === 'true'}
          label="In Stock Only"
        />
      </div>

      {attributeFacetEntries.map(([code, buckets]) => {
        // A colour-style attribute (real `AttributeOption.swatch` hex on every
        // option) gets the theme's circle-swatch filter instead of a text
        // checkbox list — matches `theme/src/pages/ProductListing.tsx`'s own
        // "Colour" filter, but only when the data backing it is real.
        const hasSwatches = buckets.every((b) => b.swatch);
        return (
          <div key={code}>
            <h3 className="mb-2 text-xs font-semibold tracking-widest text-jet uppercase">{code.replace(/[-_]/g, ' ')}</h3>
            {hasSwatches ? (
              <div className="flex flex-wrap gap-2">
                {buckets.map((bucket) => {
                  const active = params[code] === bucket.value;
                  return (
                    <Link
                      key={bucket.value}
                      href={buildPlpHref(basePath, params, toggleOverride(params, code, bucket.value))}
                      title={`${bucket.value} (${bucket.count})`}
                      className={`size-7 shrink-0 rounded-full border-2 transition-all ${active ? 'scale-110 border-jet shadow' : 'border-ghost hover:border-silver'}`}
                      style={{ backgroundColor: bucket.swatch }}
                    />
                  );
                })}
              </div>
            ) : (
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
            )}
          </div>
        );
      })}

      <div>
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold tracking-widest text-jet uppercase">
          Rating <span className="text-[10px] font-normal tracking-normal text-slate normal-case">(coming soon)</span>
        </h3>
        <div className="flex flex-col gap-1 opacity-50">
          {[4, 3, 2, 1].map((stars) => (
            <div key={stars} className="flex items-center gap-1 px-2 py-1 text-sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} className={`size-3.5 ${i < stars ? 'text-champagne' : 'text-silver'}`} />
              ))}
              <span className="ml-1 text-xs text-slate">& up</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

import Link from 'next/link';
import type { SearchResult } from '@/types/product';
import type { Brand, Category } from '@/types/category';
import type { PlpParams } from '@/lib/plp-query';
import { FilterSidebar, type CategoryNav } from './filter-sidebar';
import { SortLinks } from './sort-links';
import { ProductGrid } from './product-grid';
import { PlpPagination } from './plp-pagination';

export function PlpShell({
  basePath,
  params,
  heading,
  result,
  brands,
  breadcrumb,
  banner,
  subcategories,
  categoryNav,
}: {
  basePath: string;
  params: PlpParams;
  heading: string;
  result: SearchResult;
  brands: Brand[];
  breadcrumb?: Category[];
  /** Optional category image + description shown above the grid — only
   *  collections pages pass this today; other PlpShell callers (search,
   *  brand pages) omit it and the layout is unchanged for them. */
  banner?: { imageUrl: string | null; description: string | null };
  /** Real child categories of the current one — only collections pages pass
   *  this. Rendered as a pill row next to the title, matching the theme's
   *  reference `ProductListing.tsx`. Omitted/empty renders nothing, same as
   *  every other "don't pad with nothing real" empty-state in this app. */
  subcategories?: Category[];
  /** The sidebar "Category" list (All {parent} + siblings) — only
   *  collections pages pass this. See CategoryNav's own doc comment. */
  categoryNav?: CategoryNav;
}) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div>
      <div className="border-b border-ghost bg-ivory">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate">
              <Link href="/" className="hover:text-champagne">
                Home
              </Link>
              {breadcrumb.map((c) => (
                <span key={c.publicId} className="flex items-center gap-1">
                  <span>/</span>
                  <Link href={`/collections/${c.slug}`} className="hover:text-champagne">
                    {c.nameDefault ?? c.slug}
                  </Link>
                </span>
              ))}
            </nav>
          ) : null}

          {banner && (banner.imageUrl || banner.description) ? (
            <div className="mb-6 overflow-hidden rounded-2xl border border-ghost">
              {banner.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL, per-request/dynamic
                <img src={banner.imageUrl} alt={heading} className="h-48 w-full object-cover sm:h-64" />
              ) : null}
              {banner.description ? <p className="whitespace-pre-line bg-white px-4 py-3 text-sm text-charcoal">{banner.description}</p> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold text-jet sm:text-4xl">{heading}</h1>
              <p className="mt-1 text-sm text-slate">{result.total} products</p>
            </div>
            {subcategories && subcategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subcategories.slice(0, 6).map((sub) => (
                  <Link
                    key={sub.publicId}
                    href={`/collections/${sub.slug}`}
                    className="rounded-full border border-ghost bg-white px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:border-champagne hover:text-champagne"
                  >
                    {sub.nameDefault ?? sub.slug}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex justify-end">
            <SortLinks basePath={basePath} params={params} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row">
          <FilterSidebar
            basePath={basePath}
            params={params}
            facets={result.facets}
            brands={brands}
            categoryNav={categoryNav}
            currency={result.hits[0]?.currency ?? undefined}
          />
          <div className="flex-1">
            <ProductGrid hits={result.hits} />
            <PlpPagination basePath={basePath} params={params} page={result.page} totalPages={totalPages} />
          </div>
        </div>
      </div>
    </div>
  );
}

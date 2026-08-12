import Link from 'next/link';
import type { SearchResult } from '@/types/product';
import type { Brand, Category } from '@/types/category';
import type { PlpParams } from '@/lib/plp-query';
import { FilterSidebar } from './filter-sidebar';
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
}: {
  basePath: string;
  params: PlpParams;
  heading: string;
  result: SearchResult;
  brands: Brand[];
  breadcrumb?: Category[];
}) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline">
            Home
          </Link>
          {breadcrumb.map((c) => (
            <span key={c.publicId} className="flex items-center gap-1">
              <span>/</span>
              <Link href={`/collections/${c.slug}`} className="hover:text-foreground hover:underline">
                {c.nameDefault ?? c.slug}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{result.total} products</p>
        </div>
        <SortLinks basePath={basePath} params={params} />
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        <FilterSidebar basePath={basePath} params={params} facets={result.facets} brands={brands} />
        <div className="flex-1">
          <ProductGrid hits={result.hits} />
          <PlpPagination basePath={basePath} params={params} page={result.page} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}

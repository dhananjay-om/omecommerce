import Link from 'next/link';
import Form from 'next/form';
import { Search } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { AttributeSet, ProductList } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ProductsTable, type SortKey } from './products-table';
import { MoreFiltersPopover } from './more-filters-popover';

const DEFAULT_PAGE_SIZE = 20;
const PRODUCT_TYPES = ['SIMPLE', 'CONFIGURABLE', 'BUNDLE', 'DIGITAL', 'VIRTUAL'];
const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    type?: string;
    attributeSetId?: string;
    pageSize?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const pageSize = params.pageSize ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;
  const sortBy = (['sku', 'nameDefault', 'createdAt', 'status'].includes(params.sortBy ?? '')
    ? params.sortBy
    : 'createdAt') as SortKey;
  const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';

  const [list, attributeSets] = await Promise.all([
    apiGet<ProductList>(
      `/admin/v1/products${buildQuery({
        page,
        pageSize,
        search: params.search,
        status: params.status,
        type: params.type,
        attributeSetId: params.attributeSetId,
        sortBy,
        sortDir,
      })}`,
    ),
    apiGet<AttributeSet[]>('/admin/v1/attribute-sets'),
  ]);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  const baseFilters = {
    search: params.search,
    status: params.status,
    type: params.type,
    attributeSetId: params.attributeSetId,
    pageSize,
  };

  function sortHref(column: SortKey): string {
    const nextDir = sortBy === column && sortDir === 'asc' ? 'desc' : 'asc';
    return `/products${buildQuery({ ...baseFilters, page: 1, sortBy: column, sortDir: nextDir })}`;
  }
  const sortLinks: Record<SortKey, string> = {
    sku: sortHref('sku'),
    nameDefault: sortHref('nameDefault'),
    createdAt: sortHref('createdAt'),
    status: sortHref('status'),
  };

  const hasFilters = Boolean(params.search || params.status || params.type || params.attributeSetId);
  const moreFiltersActiveCount = [params.attributeSetId].filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          {/* Same `.page-title` size (1.32rem/800) as the Orders pages —
              the mock uses one consistent title size everywhere. */}
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} product{list.total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products/import" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Import
          </Link>
          <Link href="/products/new" className={cn(buttonVariants({ size: 'sm' }))}>
            Add Product
          </Link>
        </div>
      </div>

      {/* One search box + 2 dropdowns + "More filters" — matches the mock's
          clean filter-bar shape, same convention as the Orders list.
          next/form (not a plain <form>): this app is reverse-proxied at
          the /admin basePath — a plain `<form action="/products">` would
          silently drop that prefix on submit, the same pre-existing bug
          fixed on the Orders filter form. */}
      <Form id="products-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/products">
        <div className="relative max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input key={params.search ?? ''} name="search" placeholder="Search product, SKU, brand…" defaultValue={params.search} className="pl-8" />
        </div>
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={params.type ?? ''} className={nativeSelectClass}>
          <option value="">All types</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <MoreFiltersPopover formId="products-filters" attributeSets={attributeSets} attributeSetId={params.attributeSetId} pageSize={pageSize} activeCount={moreFiltersActiveCount} />
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/products" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        <ProductsTable products={list.products} sortLinks={sortLinks} activeSortBy={sortBy} activeSortDir={sortDir} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.products.length ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + list.products.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link
              href={`/products${buildQuery({ ...baseFilters, page: page - 1, sortBy, sortDir })}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Previous
            </Link>
          )}
          <span className="px-1">
            {page} / {totalPages}
          </span>
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link
              href={`/products${buildQuery({ ...baseFilters, page: page + 1, sortBy, sortDir })}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

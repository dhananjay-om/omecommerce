import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { AttributeSet, ProductList } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ProductsTable, type SortKey } from './products-table';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <div className="flex items-center gap-2">
          <Link href="/products/import" className={cn(buttonVariants({ variant: 'outline' }))}>
            Import
          </Link>
          <Link href="/products/new" className={cn(buttonVariants())}>
            New Product
          </Link>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2" action="/products">
        <Input
          key={params.search ?? ''}
          name="search"
          placeholder="Search by SKU or name…"
          defaultValue={params.search}
          className="max-w-sm"
        />
        <select name="status" defaultValue={params.status ?? ''} className={nativeSelectClass}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={params.type ?? ''} className={nativeSelectClass}>
          <option value="">All Types</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="attributeSetId" defaultValue={params.attributeSetId ?? ''} className={nativeSelectClass}>
          <option value="">All Attribute Sets</option>
          {attributeSets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="pageSize" defaultValue={String(pageSize)} className={nativeSelectClass}>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/products" className={cn(buttonVariants({ variant: 'ghost' }))}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-6">
        <ProductsTable products={list.products} sortLinks={sortLinks} activeSortBy={sortBy} activeSortDir={sortDir} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {list.total} product{list.total === 1 ? '' : 's'} · page {list.page} of {totalPages}
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

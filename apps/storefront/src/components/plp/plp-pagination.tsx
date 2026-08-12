import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { buildPlpHref, type PlpParams } from '@/lib/plp-query';

/** Prev/1 … current-1, current, current+1 … /Next — a plain window around the current page, ellipsis for the gaps. */
function pageWindow(current: number, totalPages: number): Array<number | 'ellipsis'> {
  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}

export function PlpPagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: PlpParams;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={buildPlpHref(basePath, params, { page: String(Math.max(1, page - 1)) })}
            aria-disabled={page <= 1}
            className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
          />
        </PaginationItem>
        {pageWindow(page, totalPages).map((entry, i) =>
          entry === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink href={buildPlpHref(basePath, params, { page: String(entry) })} isActive={entry === page}>
                {entry}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href={buildPlpHref(basePath, params, { page: String(Math.min(totalPages, page + 1)) })}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

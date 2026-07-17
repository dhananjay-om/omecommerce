'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import type { ProductListItem } from '@/lib/types';
import { bulkUpdateProductStatus } from './actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBadgeVariant } from '@/lib/status-badge';

export type SortKey = 'sku' | 'nameDefault' | 'createdAt' | 'status';

function SortableHeader({
  label,
  sortKey,
  sortLinks,
  activeSortBy,
  activeSortDir,
}: {
  label: string;
  sortKey: SortKey;
  sortLinks: Record<SortKey, string>;
  activeSortBy: string;
  activeSortDir: string;
}) {
  return (
    <TableHead>
      <Link href={sortLinks[sortKey]} className="flex items-center gap-1 hover:underline">
        {label}
        {activeSortBy === sortKey ? <span>{activeSortDir === 'asc' ? '▲' : '▼'}</span> : null}
      </Link>
    </TableHead>
  );
}

export function ProductsTable({
  products,
  sortLinks,
  activeSortBy,
  activeSortDir,
}: {
  products: ProductListItem[];
  sortLinks: Record<SortKey, string>;
  activeSortBy: string;
  activeSortDir: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const allSelected = products.length > 0 && products.every((p) => selected.has(p.publicId));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.publicId)));
  }

  function toggleOne(publicId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }

  function applyBulkStatus(status: string) {
    setError(null);
    startTransition(async () => {
      const result = await bulkUpdateProductStatus(Array.from(selected), status);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 ? (
        <div className="mb-3 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">
            {selected.size} product{selected.size === 1 ? '' : 's'} selected
          </span>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => applyBulkStatus('ACTIVE')}>
            Activate
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => applyBulkStatus('ARCHIVED')}>
            Deactivate
          </Button>
          {error ? <span className="text-destructive">{error}</span> : null}
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" className="size-4" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead className="w-14" />
              <SortableHeader label="SKU" sortKey="sku" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <SortableHeader
                label="Name"
                sortKey="nameDefault"
                sortLinks={sortLinks}
                activeSortBy={activeSortBy}
                activeSortDir={activeSortDir}
              />
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Salable Qty</TableHead>
              <SortableHeader
                label="Status"
                sortKey="status"
                sortLinks={sortLinks}
                activeSortBy={activeSortBy}
                activeSortDir={activeSortDir}
              />
              <SortableHeader
                label="Created"
                sortKey="createdAt"
                sortLinks={sortLinks}
                activeSortBy={activeSortBy}
                activeSortDir={activeSortDir}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.publicId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(p.publicId)}
                      onChange={() => toggleOne(p.publicId)}
                      aria-label={`Select ${p.sku}`}
                    />
                  </TableCell>
                  <TableCell>
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
                      <img src={p.thumbnailUrl} alt="" className="size-9 rounded-md border object-cover" />
                    ) : (
                      <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
                        <ImageIcon className="size-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/products/${p.publicId}`} className="hover:underline">
                      {p.sku}
                    </Link>
                  </TableCell>
                  <TableCell>{p.name ?? '—'}</TableCell>
                  <TableCell>{p.type}</TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell>{p.salableQuantity}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(p.createdAt).toLocaleDateString('en-US')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

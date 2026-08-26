'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ImageIcon, MoreHorizontal, Sparkles } from 'lucide-react';
import type { ProductListItem, BulkJobStatus } from '@/lib/types';
import { bulkUpdateProductStatus, submitBulkGenerateDescriptions, getBulkGenerateDescriptionsJobStatus, type BulkGenerateDescriptionsResult } from './actions';
import { DeleteProductDialog } from './delete-product-dialog';
import { Badge } from '@/components/ui/badge';
import { DotBadge } from '@/components/dot-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { statusBadgeVariant } from '@/lib/status-badge';
import { relativeDate } from '@/lib/relative-date';

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
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);

  const [genJobStatus, setGenJobStatus] = useState<BulkJobStatus<BulkGenerateDescriptionsResult> | null>(null);
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const genPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (genPollTimer.current) clearTimeout(genPollTimer.current);
    };
  }, []);

  function pollGenJob(id: string) {
    genPollTimer.current = setTimeout(async () => {
      const status = await getBulkGenerateDescriptionsJobStatus(id);
      setGenJobStatus(status);
      if (status.status === 'completed' || status.status === 'failed') {
        setGenSubmitting(false);
        return;
      }
      pollGenJob(id);
    }, 1000);
  }

  async function handleGenerateDescriptions() {
    setGenError(null);
    setGenJobStatus(null);
    setGenSubmitting(true);
    const result = await submitBulkGenerateDescriptions(Array.from(selected));
    if (result.error || !result.jobId) {
      setGenError(result.error ?? 'Something went wrong.');
      setGenSubmitting(false);
      return;
    }
    pollGenJob(result.jobId);
  }

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
      {/* Matches the mock's `.bulkbar` (accent-wash background, accent text)
          instead of a plain neutral bar — same real Activate/Deactivate
          actions this table already had, just restyled. The mock's own
          bulk bar also offers Bulk Edit/Publish/Price/Inventory, none of
          which have a real backend endpoint yet, so they're not added here. */}
      {selected.size > 0 ? (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            <span>
              {selected.size} product{selected.size === 1 ? '' : 's'} selected
            </span>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => applyBulkStatus('ACTIVE')}>
              Activate
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => applyBulkStatus('ARCHIVED')}>
              Deactivate
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={genSubmitting} onClick={handleGenerateDescriptions}>
              <Sparkles className="size-3" />
              {genSubmitting ? `Generating… ${typeof genJobStatus?.progress === 'number' ? genJobStatus.progress : 0}%` : 'Generate Missing Descriptions'}
            </Button>
            {error ? <span className="font-normal text-destructive">{error}</span> : null}
          </div>
          {genError ? <p className="text-xs text-destructive">{genError}</p> : null}
          {genJobStatus?.status === 'completed' && genJobStatus.result ? (
            <p className="text-xs text-muted-foreground">
              Generated {genJobStatus.result.generated}, skipped {genJobStatus.result.skipped} (already had a description)
              {genJobStatus.result.failed > 0 ? `, ${genJobStatus.result.failed} failed` : ''}.
            </p>
          ) : null}
          {genJobStatus?.status === 'failed' ? <p className="text-xs text-destructive">{genJobStatus.error ?? 'The job failed.'}</p> : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-6">
                <input type="checkbox" className="size-4" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <SortableHeader label="Product" sortKey="nameDefault" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <SortableHeader label="SKU" sortKey="sku" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Inventory</TableHead>
              <TableHead>Tax</TableHead>
              <SortableHeader label="Status" sortKey="status" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <SortableHeader label="Created" sortKey="createdAt" sortLinks={sortLinks} activeSortBy={activeSortBy} activeSortDir={activeSortDir} />
              <TableHead className="w-14 pr-6" />
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
                <TableRow key={p.publicId} className="cursor-pointer" onClick={() => router.push(`/products/${p.publicId}`)}>
                  <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="size-4" checked={selected.has(p.publicId)} onChange={() => toggleOne(p.publicId)} aria-label={`Select ${p.sku}`} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
                        <img src={p.thumbnailUrl} alt="" className="size-8 shrink-0 rounded-md border object-cover" />
                      ) : (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <ImageIcon className="size-4" />
                        </div>
                      )}
                      <span className="font-medium text-foreground">{p.name ?? '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                  <TableCell className="text-muted-foreground">{p.type}</TableCell>
                  <TableCell className="text-right">
                    {p.salableQuantity} units
                    {p.salableQuantity !== p.quantity ? <div className="text-xs text-muted-foreground">{p.quantity} total</div> : null}
                  </TableCell>
                  <TableCell>
                    {p.hasTaxClass ? (
                      <DotBadge variant="success">GST</DotBadge>
                    ) : (
                      <Badge variant="secondary" title="No tax class assigned — charged 0 GST at checkout">
                        None
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DotBadge variant={statusBadgeVariant(p.status)}>{p.status}</DotBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{relativeDate(p.createdAt)}</TableCell>
                  <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions for {p.sku}</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {/* One destination now — the Overview tab already has directly-editable fields, so "View" and "Edit" aren't 2 different pages anymore. */}
                          <DropdownMenuItem onClick={() => router.push(`/products/${p.publicId}`)}>Open</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* One shared, externally-controlled dialog instance for every row's
          "Delete" menu item — same base-ui "open a dialog from a menu"
          pattern as the order detail header's "..." menu. */}
      <DeleteProductDialog
        publicId={deleteTarget?.publicId ?? ''}
        sku={deleteTarget?.sku ?? ''}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

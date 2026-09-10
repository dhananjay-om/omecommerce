import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { MegaMenuItem } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeleteMegaMenuItemDialog } from './delete-mega-menu-item-dialog';

/** Content > Mega Menu — the storefront header's admin-managed nav. When
 *  this list is empty, the storefront header falls back to its original
 *  behavior (auto-generated from the category tree) — see
 *  apps/storefront/.../mega-menu.tsx's own doc comment; this page has no
 *  "empty state" warning about that, since an untouched, never-configured
 *  site keeps working exactly as it always did. */
export default async function MegaMenuPage() {
  const items = await apiGet<MegaMenuItem[]>('/admin/v1/navigation/mega-menu-items');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mega Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The storefront header's nav — top-level links, each with optional dropdown columns and a promo image.
            {items.length === 0 ? ' No items yet — the header currently falls back to the category tree.' : ''}
          </p>
        </div>
        <Link href="/content/navigation/new" className={cn(buttonVariants())}>
          New Item
        </Link>
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Columns</TableHead>
              <TableHead>Promo Image</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No menu items yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.publicId}>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="text-muted-foreground">{item.href}</TableCell>
                  <TableCell>{item.columns.length === 0 ? '—' : item.columns.length}</TableCell>
                  <TableCell>
                    {item.promoImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL
                      <img src={item.promoImageUrl} alt="" className="h-10 w-16 rounded object-cover" />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{item.position}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? 'success' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/content/navigation/${item.publicId}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        Edit
                      </Link>
                      <DeleteMegaMenuItemDialog publicId={item.publicId} label={item.label} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

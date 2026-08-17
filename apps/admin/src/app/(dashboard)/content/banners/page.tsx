import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Banner } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeleteBannerDialog } from './delete-banner-dialog';

export default async function BannersPage() {
  const banners = await apiGet<Banner[]>('/admin/v1/banners');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banners</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hero slider and promo-grid images. Shown on the storefront by placing a matching widget under Content &gt; Widgets.
          </p>
        </div>
        <Link href="/content/banners/new" className={cn(buttonVariants())}>
          New Banner
        </Link>
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No banners yet.
                </TableCell>
              </TableRow>
            ) : (
              banners.map((b) => (
                <TableRow key={b.publicId}>
                  <TableCell>
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL, per-request/dynamic
                      <img src={b.imageUrl} alt="" className="h-10 w-16 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-16 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{b.group === 'HERO' ? 'Hero' : 'Promo'}</Badge>
                  </TableCell>
                  <TableCell>{b.position}</TableCell>
                  <TableCell>
                    <Badge variant={b.isActive ? 'success' : 'secondary'}>{b.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/content/banners/${b.publicId}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        Edit
                      </Link>
                      <DeleteBannerDialog publicId={b.publicId} title={b.title} />
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

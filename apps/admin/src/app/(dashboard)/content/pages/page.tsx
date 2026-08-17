import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { CmsPage } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeletePageDialog } from './delete-page-dialog';

export default async function CmsPagesPage() {
  const pages = await apiGet<CmsPage[]>('/admin/v1/cms/pages');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Standalone content pages (About Us, Shipping Policy, Terms of Service…), rendered at /pages/:handle.
          </p>
        </div>
        <Link href="/content/pages/new" className={cn(buttonVariants())}>
          New Page
        </Link>
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No pages yet.
                </TableCell>
              </TableRow>
            ) : (
              pages.map((p) => (
                <TableRow key={p.publicId}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">/{p.handle}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'PUBLISHED' ? 'success' : 'secondary'}>{p.status === 'PUBLISHED' ? 'Published' : 'Draft'}</Badge>
                  </TableCell>
                  <TableCell>{new Date(p.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/content/pages/${p.publicId}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        Edit
                      </Link>
                      <DeletePageDialog publicId={p.publicId} title={p.title} />
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

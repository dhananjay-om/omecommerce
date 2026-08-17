import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { CmsBlock } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeleteBlockDialog } from './delete-block-dialog';

export default async function CmsBlocksPage() {
  const blocks = await apiGet<CmsBlock[]>('/admin/v1/cms/blocks');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blocks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable content snippets referenced by code — footer notes, promo copy, and the well-known codes the Home Page screen manages.
          </p>
        </div>
        <Link href="/content/blocks/new" className={cn(buttonVariants())}>
          New Block
        </Link>
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No blocks yet.
                </TableCell>
              </TableRow>
            ) : (
              blocks.map((b) => (
                <TableRow key={b.publicId}>
                  <TableCell className="font-medium">{b.code}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'PUBLISHED' ? 'success' : 'secondary'}>{b.status === 'PUBLISHED' ? 'Published' : 'Draft'}</Badge>
                  </TableCell>
                  <TableCell>{new Date(b.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/content/blocks/${b.publicId}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                        Edit
                      </Link>
                      <DeleteBlockDialog publicId={b.publicId} code={b.code} />
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

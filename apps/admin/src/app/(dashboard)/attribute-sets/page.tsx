import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { AttributeSet } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewAttributeSetDialog } from './new-attribute-set-dialog';

export default async function AttributeSetsPage() {
  const sets = await apiGet<AttributeSet[]>('/admin/v1/attribute-sets');

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Attribute Sets</h1>
        <NewAttributeSetDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Default</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No attribute sets yet.
                </TableCell>
              </TableRow>
            ) : (
              sets.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.isDefault ? 'Yes' : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/attribute-sets/${s.id}`} className="text-sm hover:underline">
                      Manage
                    </Link>
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

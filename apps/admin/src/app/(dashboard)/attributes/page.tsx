import { apiGet } from '@/lib/api-client';
import type { Attribute } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewAttributeDialog } from './new-attribute-dialog';

export default async function AttributesPage() {
  const attributes = await apiGet<Attribute[]>('/admin/v1/attributes');

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Attributes</h1>
        <NewAttributeDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Data Type</TableHead>
              <TableHead>Input Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attributes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No attributes yet.
                </TableCell>
              </TableRow>
            ) : (
              attributes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.code}</TableCell>
                  <TableCell>{a.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{a.dataType}</Badge>
                  </TableCell>
                  <TableCell>{a.inputType}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

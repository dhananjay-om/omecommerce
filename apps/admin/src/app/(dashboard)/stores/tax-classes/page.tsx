import { apiGet } from '@/lib/api-client';
import type { TaxClass } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewTaxClassDialog } from './new-tax-class-dialog';
import { EditTaxClassDialog } from './edit-tax-class-dialog';
import { DeleteTaxClassDialog } from './delete-tax-class-dialog';

function formatPercent(rate: string): string {
  const n = Number(rate) * 100;
  return `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
}

export default async function TaxClassesPage() {
  const taxClasses = await apiGet<TaxClass[]>('/admin/v1/tax-classes');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GST rate slabs (5%, 12%, 18%, 28%, ...) — assign one to each product on its edit page. CGST+SGST vs
            IGST is derived automatically at checkout from the combined rate here.
          </p>
        </div>
        <NewTaxClassDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxClasses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No tax classes yet — products with none assigned are charged 0 GST.
                </TableCell>
              </TableRow>
            ) : (
              taxClasses.map((tc) => (
                <TableRow key={tc.code}>
                  <TableCell className="font-medium">{tc.code}</TableCell>
                  <TableCell>{tc.name}</TableCell>
                  <TableCell>{formatPercent(tc.rate)}</TableCell>
                  <TableCell>
                    <Badge variant={tc.isActive ? 'success' : 'secondary'}>{tc.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <EditTaxClassDialog taxClass={tc} />
                      <DeleteTaxClassDialog code={tc.code} name={tc.name} />
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

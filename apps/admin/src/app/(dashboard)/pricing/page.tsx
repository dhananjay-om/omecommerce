import { apiGet } from '@/lib/api-client';
import type { PriceList } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewPriceListDialog } from './new-price-list-dialog';
import { SetPriceDialog } from './set-price-dialog';

export default async function PricingPage() {
  const priceLists = await apiGet<PriceList[]>('/admin/v1/price-lists');

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <NewPriceListDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceLists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No price lists yet.
                </TableCell>
              </TableRow>
            ) : (
              priceLists.map((pl) => (
                <TableRow key={pl.publicId}>
                  <TableCell className="font-medium">{pl.code}</TableCell>
                  <TableCell>{pl.name}</TableCell>
                  <TableCell>{pl.currency}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{pl.type}</Badge>
                  </TableCell>
                  <TableCell>{pl.priority}</TableCell>
                  <TableCell className="text-right">
                    <SetPriceDialog priceListCode={pl.code} />
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

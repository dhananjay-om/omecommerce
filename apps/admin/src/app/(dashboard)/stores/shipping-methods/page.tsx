import { apiGet } from '@/lib/api-client';
import type { ShippingMethod } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewShippingMethodDialog } from './new-shipping-method-dialog';
import { EditShippingMethodDialog } from './edit-shipping-method-dialog';
import { DeleteShippingMethodDialog } from './delete-shipping-method-dialog';

export default async function ShippingMethodsPage() {
  const methods = await apiGet<ShippingMethod[]>('/admin/v1/shipping-methods');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipping Methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The options a shopper sees at checkout — checkout only offers methods matching the
            cart&apos;s currency, so every currency you actually sell in needs at least one active
            method here or checkout has nothing to offer.
          </p>
        </div>
        <NewShippingMethodDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No shipping methods yet — checkout has nothing to offer until you create one.
                </TableCell>
              </TableRow>
            ) : (
              methods.map((m) => (
                <TableRow key={m.code}>
                  <TableCell className="font-medium">{m.code}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.flatRate}</TableCell>
                  <TableCell>{m.currency}</TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? 'success' : 'secondary'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <EditShippingMethodDialog method={m} />
                      <DeleteShippingMethodDialog code={m.code} name={m.name} />
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

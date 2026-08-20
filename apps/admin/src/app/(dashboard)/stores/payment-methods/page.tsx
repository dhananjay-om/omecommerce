import { apiGet } from '@/lib/api-client';
import type { PaymentMethod } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NewPaymentMethodDialog } from './new-payment-method-dialog';
import { EditPaymentMethodDialog } from './edit-payment-method-dialog';
import { DeletePaymentMethodDialog } from './delete-payment-method-dialog';

const TYPE_LABELS: Record<string, string> = { COD: 'Cash on Delivery', ONLINE: 'Online Gateway' };

export default async function PaymentMethodsPage() {
  const methods = await apiGet<PaymentMethod[]>('/admin/v1/payment-methods');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The options a shopper sees at checkout. Cash on Delivery skips charging a card entirely
            — the order stays &quot;awaiting payment&quot; until you record the cash collected, from
            that order&apos;s own page. Online Gateway methods can be registered here today, but all
            currently route through the same test gateway until a real provider is connected.
          </p>
        </div>
        <NewPaymentMethodDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No payment methods yet — checkout has nothing to offer until you create one.
                </TableCell>
              </TableRow>
            ) : (
              methods.map((m) => (
                <TableRow key={m.code}>
                  <TableCell className="font-medium">{m.code}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{TYPE_LABELS[m.type] ?? m.type}</TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? 'success' : 'secondary'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <EditPaymentMethodDialog method={m} />
                      <DeletePaymentMethodDialog code={m.code} name={m.name} />
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

import { apiGet } from '@/lib/api-client';
import type { CustomerGroup } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NewCustomerGroupDialog } from './new-customer-group-dialog';

export default async function CustomerGroupsPage() {
  const groups = await apiGet<CustomerGroup[]>('/admin/v1/customer-groups');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The pricing/B2B side of segmentation — attach a group&apos;s code to a Company
            (Companies page) and to a price list (Pricing page) to give that company&apos;s buyers
            different prices. A cart&apos;s group is always resolved server-side from the
            shopper&apos;s company membership, never sent by the browser.
          </p>
        </div>
        <NewCustomerGroupDialog />
      </div>

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Default</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No customer groups yet — every shopper sees base pricing until one exists and is
                  attached to a price list.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => (
                <TableRow key={g.code}>
                  <TableCell className="font-medium">{g.code}</TableCell>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>
                    {g.isDefault ? <Badge variant="secondary">Default</Badge> : null}
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

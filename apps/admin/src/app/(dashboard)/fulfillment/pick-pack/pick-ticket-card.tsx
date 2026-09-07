import Link from 'next/link';
import type { PickListOrder } from '@/lib/types';
import { relativeDate } from '@/lib/relative-date';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FulfillDialog } from '../../orders/fulfill-dialog';
import { BinLocationField } from './bin-location-field';

/** One pick ticket per order — real bin locations per line where set
 *  (never fabricated), and the exact same FulfillDialog the order detail
 *  page already uses for "Pack & Ship" — no second fulfillment write path
 *  for this page to keep in sync with the real one. */
export function PickTicketCard({ order }: { order: PickListOrder }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle className="text-base">
            <Link href={`/orders/${order.orderPublicId}`} className="hover:underline">
              Order #{order.orderNumber}
            </Link>
          </CardTitle>
          <CardDescription>
            {order.email} · Placed {relativeDate(order.createdAt)} · Warehouse {order.warehouseCode}
          </CardDescription>
        </div>
        <FulfillDialog orderPublicId={order.orderPublicId} lines={order.lines} />
      </CardHeader>
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Qty to pick</TableHead>
              <TableHead>Bin location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.pickLines.map((line) => (
              <TableRow key={line.sku}>
                <TableCell className="font-mono text-xs">{line.sku}</TableCell>
                <TableCell>{line.name}</TableCell>
                <TableCell>{line.qtyNeeded}</TableCell>
                <TableCell>
                  <BinLocationField sku={line.sku} warehouseCode={order.warehouseCode} binLocation={line.binLocation} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { setVariantPrice, adjustVariantStock, type ActionState } from './pricing-inventory-actions';
import type { VariantPrice, VariantStock } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

const REASONS = ['PURCHASE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'CORRECTION'];

const initialState: ActionState = { error: null, success: false };

function SetPriceRowDialog({
  productPublicId,
  variantId,
  row,
}: {
  productPublicId: string;
  variantId: string;
  row: VariantPrice;
}) {
  const action = setVariantPrice.bind(null, productPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">{row.price ? 'Edit' : 'Set Price'}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {row.priceListName} ({row.priceListCode})
          </DialogTitle>
          <DialogDescription>Price in {row.currency}.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="variantId" value={variantId} />
          <input type="hidden" name="priceListCode" value={row.priceListCode} />
          <div className="space-y-2">
            <Label htmlFor={`price-${row.priceListCode}`}>Price</Label>
            <Input
              id={`price-${row.priceListCode}`}
              name="price"
              required
              defaultValue={row.price ?? ''}
              placeholder="e.g. 19.99"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`mrp-${row.priceListCode}`}>MRP (optional)</Label>
            <Input
              id={`mrp-${row.priceListCode}`}
              name="mrp"
              defaultValue={row.mrp ?? ''}
              placeholder="e.g. 24.99 — shown struck through when higher than Price"
            />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockRowDialog({
  productPublicId,
  variantId,
  row,
}: {
  productPublicId: string;
  variantId: string;
  row: VariantStock;
}) {
  const action = adjustVariantStock.bind(null, productPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const [handledState, setHandledState] = useState(state);
  const [delta, setDelta] = useState('');

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDelta('');
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Adjust</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock — {row.warehouseName}</DialogTitle>
          <DialogDescription>
            Currently {row.onHand} on hand, {row.reserved} reserved, {row.available} available.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="variantId" value={variantId} />
          <input type="hidden" name="warehouseCode" value={row.warehouseCode} />
          <div className="space-y-2">
            <Label htmlFor={`delta-${row.warehouseCode}`}>Quantity change</Label>
            <Input
              id={`delta-${row.warehouseCode}`}
              name="delta"
              type="number"
              step="1"
              required
              placeholder="e.g. 10 to add, -2 to remove"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This is a <strong>change</strong>, not the new total — enter a positive number to add
              stock or a negative number to remove it.
              {row.onHand !== 0 ? (
                <>
                  {' '}
                  To bring this to 0, use{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline underline-offset-2"
                    onClick={() => setDelta(String(-row.onHand))}
                  >
                    {-row.onHand}
                  </button>
                  .
                </>
              ) : null}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`reason-${row.warehouseCode}`}>Reason</Label>
            <Select name="reason" defaultValue="PURCHASE">
              <SelectTrigger id={`reason-${row.warehouseCode}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`note-${row.warehouseCode}`}>Note (optional)</Label>
            <Textarea id={`note-${row.warehouseCode}`} name="note" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adjusting…' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Price and stock are variant-scoped in this system (per price-list, per warehouse), not
 * plain product fields — this section surfaces and edits the existing Pricing/Inventory
 * systems for the product's single implicit variant, rather than faking denormalized
 * product-level columns.
 */
export function PricingInventorySection({
  productPublicId,
  variantId,
  prices,
  stock,
}: {
  productPublicId: string;
  variantId: string;
  prices: VariantPrice[];
  stock: VariantStock[];
}) {
  const totalAvailable = stock.reduce((sum, row) => sum + row.available, 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Pricing</h4>
        </div>
        {prices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No price lists exist yet. Create one on the Pricing page first.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Price List</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((row) => (
                <TableRow key={row.priceListCode}>
                  <TableCell>{row.priceListName}</TableCell>
                  <TableCell>{row.currency}</TableCell>
                  <TableCell>
                    {row.price ? (
                      <span className="flex items-center gap-2">
                        {formatPrice(row.price, row.currency)}
                        {row.mrp && Number(row.mrp) > Number(row.price) ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(row.mrp, row.currency)}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <SetPriceRowDialog productPublicId={productPublicId} variantId={variantId} row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Inventory</h4>
          {stock.length > 0 ? (
            <Badge variant={totalAvailable > 0 ? 'success' : 'destructive'}>
              {totalAvailable > 0 ? 'In Stock' : 'Out of Stock'}
            </Badge>
          ) : null}
        </div>
        {stock.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No warehouses exist yet. Create one on the Inventory page first.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead>On Hand</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((row) => (
                <TableRow key={row.warehouseCode}>
                  <TableCell>{row.warehouseName}</TableCell>
                  <TableCell>{row.onHand}</TableCell>
                  <TableCell>{row.reserved}</TableCell>
                  <TableCell>{row.available}</TableCell>
                  <TableCell>
                    <Badge variant={row.available > 0 ? 'success' : 'secondary'}>
                      {row.available > 0 ? 'In Stock' : 'Out of Stock'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AdjustStockRowDialog productPublicId={productPublicId} variantId={variantId} row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

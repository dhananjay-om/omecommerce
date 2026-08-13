'use client';

import { useActionState, useState } from 'react';
import { adjustStock, findProductForAdjustment, type ActionState, type FindProductState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const REASONS = ['PURCHASE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'CORRECTION'];

const initialAdjustState: ActionState = { error: null, success: false };
const initialFindState: FindProductState = { error: null, product: null };

/**
 * Two ways to open this:
 * - `initialVariant` set (a stock table row's "Adjust" button) — already
 *   knows exactly which variant, so skips straight to the adjustment form.
 * - `initialVariant` unset (the page-level "Adjust Stock" button) — for
 *   adjusting a SKU that isn't in this warehouse's stock table yet (no
 *   stock_item row exists for it here). Finds the product by SKU first
 *   (see actions.ts's resolveProductBySkuCascade for why this needs a
 *   cascade, not a single lookup), then — if it's a configurable product
 *   with more than one variant — asks which variant.
 */
export function AdjustStockDialog({
  warehouseCode,
  initialVariant,
}: {
  warehouseCode: string;
  initialVariant?: { publicId: string; sku: string };
}) {
  const [open, setOpen] = useState(false);
  const [adjustState, adjustAction, adjustPending] = useActionState(adjustStock, initialAdjustState);
  const [handledAdjustState, setHandledAdjustState] = useState(adjustState);

  const [findState, findAction, findPending] = useActionState(findProductForAdjustment, initialFindState);
  const [handledFindState, setHandledFindState] = useState(findState);
  const [confirmedProduct, setConfirmedProduct] = useState(findState.product);

  if (adjustState !== handledAdjustState) {
    setHandledAdjustState(adjustState);
    if (adjustState.success) setOpen(false);
  }
  if (findState !== handledFindState) {
    setHandledFindState(findState);
    if (findState.product) setConfirmedProduct(findState.product);
  }

  const resolvedVariant = initialVariant ?? null;
  const searchedProduct = resolvedVariant ? null : confirmedProduct;
  const singleVariant = searchedProduct?.variants.length === 1 ? searchedProduct.variants[0] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmedProduct(null); // reset the search step for next time
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size={initialVariant ? 'sm' : 'default'}>{initialVariant ? 'Adjust' : 'Adjust Stock'}</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock — {warehouseCode}</DialogTitle>
          {!resolvedVariant && !searchedProduct ? (
            <DialogDescription>Enter the product&apos;s SKU to find it.</DialogDescription>
          ) : null}
        </DialogHeader>

        {!resolvedVariant && !searchedProduct ? (
          <form action={findAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" required placeholder="e.g. DEMO-TSHIRT or DEMO-TSHIRT-red-m" />
            </div>
            {findState.error ? <p className="text-sm text-destructive">{findState.error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={findPending}>
                {findPending ? 'Searching…' : 'Find'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form action={adjustAction} className="space-y-4">
            <input type="hidden" name="warehouseCode" value={warehouseCode} />

            {resolvedVariant ? (
              <>
                <input type="hidden" name="variantId" value={resolvedVariant.publicId} />
                <p className="text-sm text-muted-foreground">
                  Adjusting <span className="font-medium text-foreground">{resolvedVariant.sku}</span>
                </p>
              </>
            ) : singleVariant ? (
              <>
                <input type="hidden" name="variantId" value={singleVariant.publicId} />
                <p className="text-sm text-muted-foreground">
                  Adjusting <span className="font-medium text-foreground">{singleVariant.sku}</span>
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="variantId">Variant</Label>
                <Select name="variantId" defaultValue={searchedProduct?.preselectedVariantId ?? undefined}>
                  <SelectTrigger id="variantId" className="w-full">
                    <SelectValue placeholder="Select a variant">
                      {(value: string | null) => searchedProduct?.variants.find((v) => v.publicId === value)?.label ?? 'Select a variant'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {searchedProduct?.variants.map((v) => (
                      <SelectItem key={v.publicId} value={v.publicId}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="delta">Quantity change</Label>
              <Input id="delta" name="delta" type="number" step="1" required placeholder="e.g. 10 to add, -2 to remove" />
              <p className="text-xs text-muted-foreground">
                This is a <strong>change</strong>, not the new total. To zero out stock, check the
                variant&apos;s current On Hand on this warehouse&apos;s stock table (or the product&apos;s
                own Pricing &amp; Inventory section) and enter that same number as negative.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select name="reason" defaultValue="PURCHASE">
                <SelectTrigger id="reason" className="w-full">
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
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" name="note" />
            </div>
            {adjustState.error ? <p className="text-sm text-destructive">{adjustState.error}</p> : null}
            <DialogFooter className="gap-2 sm:justify-between">
              {!resolvedVariant ? (
                <Button type="button" variant="ghost" onClick={() => setConfirmedProduct(null)}>
                  ← Search a different SKU
                </Button>
              ) : null}
              <Button type="submit" disabled={adjustPending}>
                {adjustPending ? 'Adjusting…' : 'Adjust Stock'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

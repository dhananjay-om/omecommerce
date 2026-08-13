'use client';

import { useActionState, useState } from 'react';
import { setPrice, findProductForPricing, type ActionState, type FindProductState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialSetPriceState: ActionState = { error: null, success: false };
const initialFindState: FindProductState = { error: null, product: null };

/** Two-step, same UX as Inventory's AdjustStockDialog: find the product by SKU first
 *  (cascading through trailing -segments so a full variant SKU also resolves — see
 *  resolve-product-by-sku.ts), then set the price on whichever variant is meant. */
export function SetPriceDialog({ priceListCode }: { priceListCode: string }) {
  const [open, setOpen] = useState(false);
  const [setPriceState, setPriceAction, setPricePending] = useActionState(setPrice, initialSetPriceState);
  const [handledSetPriceState, setHandledSetPriceState] = useState(setPriceState);

  const [findState, findAction, findPending] = useActionState(findProductForPricing, initialFindState);
  const [handledFindState, setHandledFindState] = useState(findState);
  const [confirmedProduct, setConfirmedProduct] = useState(findState.product);

  if (setPriceState !== handledSetPriceState) {
    setHandledSetPriceState(setPriceState);
    if (setPriceState.success) setOpen(false);
  }
  if (findState !== handledFindState) {
    setHandledFindState(findState);
    if (findState.product) setConfirmedProduct(findState.product);
  }

  const singleVariant = confirmedProduct?.variants.length === 1 ? confirmedProduct.variants[0] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmedProduct(null); // reset the search step for next time
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Set Price</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Price — {priceListCode}</DialogTitle>
          {!confirmedProduct ? <DialogDescription>Enter the product&apos;s SKU to find it.</DialogDescription> : null}
        </DialogHeader>

        {!confirmedProduct ? (
          <form action={findAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sp-sku">SKU</Label>
              <Input id="sp-sku" name="sku" required placeholder="e.g. DEMO-TSHIRT or DEMO-TSHIRT-red-m" />
            </div>
            {findState.error ? <p className="text-sm text-destructive">{findState.error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={findPending}>
                {findPending ? 'Searching…' : 'Find'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form action={setPriceAction} className="space-y-4">
            <input type="hidden" name="priceListCode" value={priceListCode} />

            {singleVariant ? (
              <>
                <input type="hidden" name="variantId" value={singleVariant.publicId} />
                <p className="text-sm text-muted-foreground">
                  Pricing <span className="font-medium text-foreground">{singleVariant.sku}</span>
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="sp-variantId">Variant</Label>
                <Select name="variantId" defaultValue={confirmedProduct.preselectedVariantId ?? undefined}>
                  <SelectTrigger id="sp-variantId" className="w-full">
                    <SelectValue placeholder="Select a variant">
                      {(value: string | null) => confirmedProduct.variants.find((v) => v.publicId === value)?.label ?? 'Select a variant'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {confirmedProduct.variants.map((v) => (
                      <SelectItem key={v.publicId} value={v.publicId}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sp-price">Price</Label>
              <Input id="sp-price" name="price" required placeholder="e.g. 19.99" />
            </div>
            {setPriceState.error ? <p className="text-sm text-destructive">{setPriceState.error}</p> : null}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setConfirmedProduct(null)}>
                ← Search a different SKU
              </Button>
              <Button type="submit" disabled={setPricePending}>
                {setPricePending ? 'Saving…' : 'Set Price'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

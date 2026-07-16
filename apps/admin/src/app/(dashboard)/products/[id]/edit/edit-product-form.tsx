'use client';

import { useActionState } from 'react';
import { updateProduct, type UpdateProductFormState } from '../../actions';
import type { AttributeSet, ProductDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const VISIBILITIES = ['BOTH', 'CATALOG', 'SEARCH', 'NOT_VISIBLE'];

const initialState: UpdateProductFormState = { error: null };

export function EditProductForm({ product, attributeSets }: { product: ProductDetail; attributeSets: AttributeSet[] }) {
  const action = updateProduct.bind(null, product.publicId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label>SKU</Label>
        <Input value={product.sku} disabled />
        <p className="text-xs text-muted-foreground">SKU can&apos;t be changed after creation.</p>
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <Input value={product.type} disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nameDefault">Name</Label>
        <Input id="nameDefault" name="nameDefault" defaultValue={product.name ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="weight">Weight (kg)</Label>
        <Input id="weight" name="weight" type="number" step="0.0001" min="0" defaultValue={product.weight ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="attributeSetId">Attribute set</Label>
        <Select name="attributeSetId" defaultValue={product.attributeSetId}>
          <SelectTrigger id="attributeSetId" className="w-full">
            <SelectValue placeholder="Select an attribute set">
              {(value: string | null) => attributeSets.find((s) => s.id === value)?.name ?? 'Select an attribute set'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {attributeSets.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={product.status}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Select name="visibility" defaultValue={product.visibility}>
          <SelectTrigger id="visibility" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITIES.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

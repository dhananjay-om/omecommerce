'use client';

import { useActionState } from 'react';
import { createProduct, type CreateProductFormState } from '../actions';
import type { AttributeSet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRODUCT_TYPES = ['SIMPLE', 'CONFIGURABLE', 'BUNDLE', 'DIGITAL', 'VIRTUAL'];
const STATUSES = ['DRAFT', 'ACTIVE', 'DISABLED'];

const initialState: CreateProductFormState = { error: null };

export function CreateProductForm({ attributeSets }: { attributeSets: AttributeSet[] }) {
  const [state, formAction, pending] = useActionState(createProduct, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" name="sku" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nameDefault">Name</Label>
        <Input id="nameDefault" name="nameDefault" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select name="type" defaultValue="SIMPLE">
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="attributeSetId">Attribute set</Label>
        <Select name="attributeSetId" defaultValue={attributeSets.find((s) => s.isDefault)?.id ?? attributeSets[0]?.id}>
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
        <Select name="status" defaultValue="DRAFT">
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

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create Product'}
      </Button>
    </form>
  );
}

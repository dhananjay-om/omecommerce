'use client';

import { useActionState, useState } from 'react';
import { createProduct, type CreateProductFormState } from '../actions';
import type { AttributeSet, AttributeSetDetail, Category } from '@/lib/types';
import { AttributeFieldsSection } from '../attribute-fields-section';
import { CategoryPicker } from '../category-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRODUCT_TYPES = ['SIMPLE', 'CONFIGURABLE', 'BUNDLE', 'DIGITAL', 'VIRTUAL'];
const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

const initialState: CreateProductFormState = { error: null };

export function CreateProductForm({
  attributeSets,
  attributeSetDetails,
  categories,
}: {
  attributeSets: AttributeSet[];
  attributeSetDetails: Record<string, AttributeSetDetail>;
  categories: Category[];
}) {
  const [state, formAction, pending] = useActionState(createProduct, initialState);
  const defaultAttributeSetId = attributeSets.find((s) => s.isDefault)?.id ?? attributeSets[0]?.id ?? '';
  const [attributeSetId, setAttributeSetId] = useState(defaultAttributeSetId);
  const selectedSetDetail = attributeSetDetails[attributeSetId];

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
        <Label htmlFor="weight">Weight (kg)</Label>
        <Input id="weight" name="weight" type="number" step="0.0001" min="0" />
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
        <Select name="attributeSetId" value={attributeSetId} onValueChange={(value) => setAttributeSetId(String(value))}>
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

      {selectedSetDetail ? <AttributeFieldsSection groups={selectedSetDetail.groups} values={{}} /> : null}

      <CategoryPicker categories={categories} selectedIds={[]} />

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create Product'}
      </Button>
    </form>
  );
}

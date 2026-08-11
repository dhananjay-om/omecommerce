'use client';

import { useActionState, useState } from 'react';
import { createProduct, type CreateProductFormState } from '../actions';
import type { AttributeSet, AttributeSetDetail, Category } from '@/lib/types';
import { AttributeFieldsSection } from '../attribute-fields-section';
import { DEFAULT_ATTRIBUTE_GROUPS } from '../default-attribute-groups';
import { CategoryPicker } from '../category-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRODUCT_TYPES = ['SIMPLE', 'CONFIGURABLE', 'BUNDLE', 'DIGITAL', 'VIRTUAL'];
const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

const initialState: CreateProductFormState = { error: null };

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">{children}</CardContent>
    </Card>
  );
}

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
  const [type, setType] = useState('SIMPLE');
  const selectedSetDetail = attributeSetDetails[attributeSetId];

  return (
    <form action={formAction} className="space-y-6">
      <SectionCard title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" name="sku" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select name="type" value={type} onValueChange={(value) => setType(String(value))}>
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
            {type === 'CONFIGURABLE' ? (
              <p className="text-xs text-muted-foreground">
                Save the product first, then generate its Size/Color variants from the edit page.
              </p>
            ) : null}
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nameDefault">Name</Label>
            <Input id="nameDefault" name="nameDefault" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input id="weight" name="weight" type="number" step="0.0001" min="0" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Status">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </SectionCard>

      <SectionCard title="Attributes">
        <AttributeFieldsSection groups={[...DEFAULT_ATTRIBUTE_GROUPS, ...(selectedSetDetail?.groups ?? [])]} values={{}} />
      </SectionCard>

      <SectionCard title="Categories">
        <CategoryPicker categories={categories} selectedIds={[]} />
      </SectionCard>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create Product'}
      </Button>
    </form>
  );
}

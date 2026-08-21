'use client';

import { useActionState, useState } from 'react';
import { updateProduct, type UpdateProductFormState } from '../../actions';
import type { AttributeSet, AttributeSetDetail, Category, ProductDetail, TaxClass } from '@/lib/types';
import { AttributeFieldsSection } from '../../attribute-fields-section';
import { DEFAULT_ATTRIBUTE_GROUPS } from '../../default-attribute-groups';
import { CategoryPicker } from '../../category-picker';
import { ImageUploadField } from './image-upload-field';
import { PricingInventorySection } from './pricing-inventory-section';
import { VariantsSection } from './variants-section';
import type { VariantPricingEntry } from './page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const VISIBILITIES = ['BOTH', 'CATALOG', 'SEARCH', 'NOT_VISIBLE'];

const initialState: UpdateProductFormState = { error: null };

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

export function EditProductForm({
  product,
  attributeSets,
  attributeSetDetails,
  categories,
  taxClasses,
  variantPricing,
}: {
  product: ProductDetail;
  attributeSets: AttributeSet[];
  attributeSetDetails: Record<string, AttributeSetDetail>;
  categories: Category[];
  taxClasses: TaxClass[];
  variantPricing: VariantPricingEntry[];
}) {
  const action = updateProduct.bind(null, product.publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [attributeSetId, setAttributeSetId] = useState(product.attributeSetId);
  const selectedSetDetail = attributeSetDetails[attributeSetId];

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <SectionCard title="Basic Information">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <Label>URL Slug</Label>
              <Input value={`/${product.slug}.html`} disabled />
              <p className="text-xs text-muted-foreground">
                Auto-generated from the name at creation — can&apos;t be changed afterward.
              </p>
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
              <Input id="nameDefault" name="nameDefault" defaultValue={product.name ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" name="weight" type="number" step="0.0001" min="0" defaultValue={product.weight ?? ''} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Status & Visibility">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </SectionCard>

        <SectionCard title="Tax">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="taxClassId">Tax Class</Label>
              <Select name="taxClassId" defaultValue={product.taxClassId ?? ''}>
                <SelectTrigger id="taxClassId" className="w-full">
                  <SelectValue placeholder="None (0% GST)">
                    {(value: string | null) => taxClasses.find((tc) => tc.id === value)?.name ?? 'None (0% GST)'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {taxClasses.map((tc) => (
                    <SelectItem key={tc.id} value={tc.id}>
                      {tc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hsnCode">HSN/SAC Code</Label>
              <Input id="hsnCode" name="hsnCode" maxLength={8} defaultValue={product.hsnCode ?? ''} placeholder="e.g. 61091000" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Attributes">
          <AttributeFieldsSection
            groups={[...DEFAULT_ATTRIBUTE_GROUPS, ...(selectedSetDetail?.groups ?? [])]}
            values={product.attributes}
          />
        </SectionCard>

        <SectionCard title="Categories">
          <CategoryPicker categories={categories} selectedIds={product.categoryIds} />
        </SectionCard>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>

      {/* Variants and Pricing & Inventory each save independently via their own dialogs/forms
          (not through "Save Changes" above) — kept as siblings of, not nested inside, the main
          <form>, since HTML doesn't allow a <form> inside another <form>. */}
      {product.type === 'CONFIGURABLE' ? (
        <SectionCard title="Variants">
          <VariantsSection
            productPublicId={product.publicId}
            groups={selectedSetDetail?.groups ?? []}
            variants={product.variants}
          />
        </SectionCard>
      ) : null}

      {variantPricing.length > 0 ? (
        <SectionCard title="Pricing & Inventory">
          <div className="space-y-8">
            {variantPricing.map(({ variant, prices, stock }, i) => (
              <div key={variant.publicId} className={i > 0 ? 'border-t pt-8' : undefined}>
                {variantPricing.length > 1 ? (
                  <div className="mb-4 flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{variant.sku}</span>
                    {variant.axisValues.map((a) => (
                      <Badge key={a.attributeCode} variant="outline">
                        {a.attributeLabel}: {a.optionLabel}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <PricingInventorySection
                  productPublicId={product.publicId}
                  variantId={variant.publicId}
                  prices={prices}
                  stock={stock}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Images">
        <ImageUploadField productPublicId={product.publicId} media={product.media} />
      </SectionCard>
    </div>
  );
}

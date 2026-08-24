'use client';

import { useActionState, useState } from 'react';
import { Sparkles, Upload } from 'lucide-react';
import { updateProduct, type UpdateProductFormState } from '../actions';
import type { AttributeSet, AttributeSetDetail, Category, ProductDetail, TaxClass } from '@/lib/types';
import { AttributeFieldsSection } from '../attribute-fields-section';
import { DESCRIPTION_GROUP } from '../default-attribute-groups';
import { CategoryPicker } from '../category-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StickyFormActions } from '@/components/sticky-form-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const VISIBILITIES = ['BOTH', 'CATALOG', 'SEARCH', 'NOT_VISIBLE'];
const AI_QUICK_ACTIONS = ['Generate SEO Title', 'Generate Meta Description', 'Analyze Product Performance', 'Suggest Price', 'Suggest Category', 'Detect Missing Product Data'];

const initialState: UpdateProductFormState = { error: null };

/** Matches the mock's `.card-head`/`.card-title` sizing (0.88rem/700)
 *  instead of the default `CardTitle`'s larger 16px/medium weight. */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-[0.88rem] font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">{children}</CardContent>
    </Card>
  );
}

/** Matches the mock's `.field label` — 0.72rem, bold, uppercase, letter-
 *  spaced — instead of the default `Label`'s 14px/medium/sentence-case. */
const fieldLabelClass = 'text-[0.72rem] font-bold tracking-wide text-muted-foreground uppercase';

export function ProductOverviewForm({
  product,
  attributeSets,
  attributeSetDetails,
  categories,
  taxClasses,
}: {
  product: ProductDetail;
  attributeSets: AttributeSet[];
  attributeSetDetails: Record<string, AttributeSetDetail>;
  categories: Category[];
  taxClasses: TaxClass[];
}) {
  const action = updateProduct.bind(null, product.publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [attributeSetId, setAttributeSetId] = useState(product.attributeSetId);
  const selectedSetDetail = attributeSetDetails[attributeSetId];
  const categoryNames = categories.filter((c) => product.categoryIds.includes(c.publicId)).map((c) => c.nameDefault ?? c.slug);

  return (
    <div className="space-y-6">
      <form id="product-overview-form" action={formAction} className="space-y-6">
        {/* Matches the mock's Overview tab: a "Product Information" card
            (title/brand/type/category/tags) beside an "AI Product
            Assistant" panel. Real fields (Title, Type, Category-preview)
            are wired to real data; Brand/Vendor and Tags have no backend
            concept yet in this system, so they're disabled placeholders
            rather than fake inputs that would silently do nothing on
            save — same for the entire AI panel, which has no real AI
            backend (see nav-data.ts's AI group, all "Coming soon").
            Description is edited in the Attributes card below, not
            duplicated here, to avoid two editable copies of the same
            field on one page. */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <SectionCard title="Product Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nameDefault" className={fieldLabelClass}>
                    Title
                  </Label>
                  <Button type="button" variant="ghost" size="sm" disabled title="Coming soon">
                    <Sparkles className="size-3" />
                    Generate
                  </Button>
                </div>
                <Input id="nameDefault" name="nameDefault" defaultValue={product.name ?? ''} />
              </div>
              <div className="space-y-2">
                <Label className={fieldLabelClass}>Brand / Vendor</Label>
                <Input disabled placeholder="Coming soon" />
              </div>
              <div className="space-y-2">
                <Label className={fieldLabelClass}>Product Type</Label>
                <Input value={product.type} disabled />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className={fieldLabelClass}>Category</Label>
                <Input value={categoryNames.length > 0 ? categoryNames.join(', ') : 'No categories assigned'} disabled />
                <p className="text-xs text-muted-foreground">Edit category assignment in Categories below.</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className={fieldLabelClass}>Tags</Label>
                <Button type="button" variant="ghost" size="sm" disabled title="Coming soon">
                  <Sparkles className="size-3" />
                  Generate Tags
                </Button>
              </div>
              <div className="mt-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">No tags yet — coming soon.</div>
            </div>
          </SectionCard>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-1.5 text-[0.88rem] font-bold">
                <Sparkles className="size-3.5 text-primary" />
                AI Product Assistant
              </CardTitle>
              <p className="text-xs text-muted-foreground">Generate content, or upload a photo and let AI draft the listing.</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold">Generate from Image</p>
                <p className="mt-1 text-xs text-muted-foreground">Upload a product photo — AI detects the dominant color and product type, then drafts title, description, tags and SEO copy.</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1" disabled title="Coming soon">
                    <Upload className="size-3" />
                    Upload Photo
                  </Button>
                  <Button type="button" size="sm" className="flex-1" disabled title="Coming soon">
                    <Sparkles className="size-3" />
                    Analyze &amp; Generate
                  </Button>
                </div>
              </div>
              <div className="text-[0.72rem] font-bold tracking-wide text-muted-foreground uppercase">Quick Actions</div>
              {AI_QUICK_ACTIONS.map((a) => (
                <Button key={a} type="button" variant="outline" size="sm" className="w-full justify-start" disabled title="Coming soon">
                  <Sparkles className="size-3" />
                  {a}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <SectionCard title="Status & Visibility">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status" className={fieldLabelClass}>
                Status
              </Label>
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
              <Label htmlFor="visibility" className={fieldLabelClass}>
                Visibility
              </Label>
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
              <Label htmlFor="taxClassId" className={fieldLabelClass}>
                Tax Class
              </Label>
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
              <Label htmlFor="hsnCode" className={fieldLabelClass}>
                HSN/SAC Code
              </Label>
              <Input id="hsnCode" name="hsnCode" maxLength={8} defaultValue={product.hsnCode ?? ''} placeholder="e.g. 61091000" />
            </div>
          </div>
        </SectionCard>

        {/* Also carries the real "Attribute set" picker — moved here from
            the old "Basic Information" card (SKU/Type stayed above, in
            Product Information) since attribute set choice determines
            which attribute fields render right below it. */}
        <SectionCard title="Attributes">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="attributeSetId" className={fieldLabelClass}>
              Attribute set
            </Label>
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
          {/* SEO_GROUP intentionally excluded — those fields have their own
              tab + their own dedicated, categories-safe save action (see
              updateProductAttributes' doc comment). Weight also lives here
              now (was in the old "Basic Information" card). */}
          <div className="max-w-xs space-y-2">
            <Label htmlFor="weight" className={fieldLabelClass}>
              Weight (kg)
            </Label>
            <Input id="weight" name="weight" type="number" step="0.0001" min="0" defaultValue={product.weight ?? ''} />
          </div>
          <AttributeFieldsSection groups={[DESCRIPTION_GROUP, ...(selectedSetDetail?.groups ?? [])]} values={product.attributes} />
        </SectionCard>

        <SectionCard title="Categories">
          <CategoryPicker categories={categories} selectedIds={product.categoryIds} />
        </SectionCard>
      </form>

      <StickyFormActions pending={pending} label="Save Changes" pendingLabel="Saving…" error={state.error} formId="product-overview-form" />
    </div>
  );
}

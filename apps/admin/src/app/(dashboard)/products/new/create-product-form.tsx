'use client';

import { useActionState, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { createProduct, type CreateProductFormState } from '../actions';
import type { AttributeSet, AttributeSetDetail, Category, TaxClass } from '@/lib/types';
import { AttributeFieldsSection, attributeInputName } from '../attribute-fields-section';
import { DEFAULT_ATTRIBUTE_GROUPS } from '../default-attribute-groups';
import { CategoryPicker } from '../category-picker';
import { TagsField } from '../[id]/tags-field';
import { generateTitle, generateTags, generateDescription, generateShortDescription, type ProductAiContext } from '../[id]/ai-product-assistant-actions';
import { AiProductAssistantCreate } from './ai-product-assistant-create';
import { StickyFormActions } from '@/components/sticky-form-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRODUCT_TYPES = ['SIMPLE', 'CONFIGURABLE', 'BUNDLE', 'DIGITAL', 'VIRTUAL'];
const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const fieldLabelClass = 'text-[0.72rem] font-bold tracking-wide text-muted-foreground uppercase';

// Content-generation routes don't resolve `:id` at all (see ai.module.ts)
// — safe to reuse with a placeholder while the product doesn't exist yet.
const DRAFT_ID = 'new';

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
  taxClasses,
}: {
  attributeSets: AttributeSet[];
  attributeSetDetails: Record<string, AttributeSetDetail>;
  categories: Category[];
  taxClasses: TaxClass[];
}) {
  const [state, formAction, pending] = useActionState(createProduct, initialState);
  const defaultAttributeSetId = attributeSets.find((s) => s.isDefault)?.id ?? attributeSets[0]?.id ?? '';
  const [attributeSetId, setAttributeSetId] = useState(defaultAttributeSetId);
  const [type, setType] = useState('SIMPLE');
  const selectedSetDetail = attributeSetDetails[attributeSetId];
  // No category is ever assigned before creation (CategoryPicker's live
  // selection isn't tracked here) — used as getContext()'s "already
  // assigned" list, deliberately always empty. The real, full list to
  // suggest FROM is availableCategoryNames, below.
  const categoryNames: string[] = [];
  const availableCategoryNames = categories.map((c) => c.nameDefault ?? c.slug);

  const [tags, setTags] = useState<string[]>([]);
  const [skuValue, setSkuValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [titleGenPending, setTitleGenPending] = useState(false);
  const [titleGenError, setTitleGenError] = useState<string | null>(null);
  const [tagsGenPending, setTagsGenPending] = useState(false);
  const [tagsGenError, setTagsGenError] = useState<string | null>(null);
  const [descGenPending, setDescGenPending] = useState(false);
  const [descGenError, setDescGenError] = useState<string | null>(null);
  const [shortDescGenPending, setShortDescGenPending] = useState(false);
  const [shortDescGenError, setShortDescGenError] = useState<string | null>(null);

  function fieldEl(code: string): HTMLTextAreaElement | HTMLInputElement | null {
    return document.getElementById(attributeInputName(code)) as HTMLTextAreaElement | HTMLInputElement | null;
  }

  /** Same "read the form's current, possibly-unsaved values" posture as
   *  the edit page's own getContext — there's no server-rendered `product`
   *  to fall back to here since nothing exists yet. */
  function getContext(): ProductAiContext {
    return {
      title: titleInputRef.current?.value ?? '',
      description: fieldEl('description')?.value,
      sku: skuValue,
      productType: type,
      categoryNames,
      tags,
    };
  }

  async function handleGenerateTitle() {
    setTitleGenPending(true);
    setTitleGenError(null);
    try {
      const result = await generateTitle(DRAFT_ID, getContext());
      if (result.error || !result.data) {
        setTitleGenError(result.error ?? 'Generation failed.');
        return;
      }
      if (titleInputRef.current) titleInputRef.current.value = result.data.title;
    } finally {
      setTitleGenPending(false);
    }
  }

  async function handleGenerateTags() {
    setTagsGenPending(true);
    setTagsGenError(null);
    try {
      const result = await generateTags(DRAFT_ID, getContext());
      if (result.error || !result.data) {
        setTagsGenError(result.error ?? 'Generation failed.');
        return;
      }
      setTags(result.data.tags);
    } finally {
      setTagsGenPending(false);
    }
  }

  async function handleGenerateDescription() {
    setDescGenPending(true);
    setDescGenError(null);
    try {
      const result = await generateDescription(DRAFT_ID, getContext());
      if (result.error || !result.data) {
        setDescGenError(result.error ?? 'Generation failed.');
        return;
      }
      const el = fieldEl('description');
      if (el) el.value = result.data.description;
    } finally {
      setDescGenPending(false);
    }
  }

  async function handleGenerateShortDescription() {
    setShortDescGenPending(true);
    setShortDescGenError(null);
    try {
      const result = await generateShortDescription(DRAFT_ID, getContext());
      if (result.error || !result.data) {
        setShortDescGenError(result.error ?? 'Generation failed.');
        return;
      }
      const el = fieldEl('short_description');
      if (el) el.value = result.data.shortDescription;
    } finally {
      setShortDescGenPending(false);
    }
  }

  function renderDescriptionFieldAction(code: string) {
    if (code === 'description') {
      return (
        <Button type="button" variant="ghost" size="sm" disabled={descGenPending} onClick={handleGenerateDescription}>
          <Sparkles className="size-3" />
          {descGenPending ? 'Generating…' : 'Generate'}
        </Button>
      );
    }
    if (code === 'short_description') {
      return (
        <Button type="button" variant="ghost" size="sm" disabled={shortDescGenPending} onClick={handleGenerateShortDescription}>
          <Sparkles className="size-3" />
          {shortDescGenPending ? 'Generating…' : 'Generate'}
        </Button>
      );
    }
    return null;
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SectionCard title="Basic Information">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" required value={skuValue} onChange={(e) => setSkuValue(e.target.value)} />
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
              <div className="flex items-center justify-between">
                <Label htmlFor="nameDefault">Name</Label>
                <Button type="button" variant="ghost" size="sm" disabled={titleGenPending} onClick={handleGenerateTitle}>
                  <Sparkles className="size-3" />
                  {titleGenPending ? 'Generating…' : 'Generate'}
                </Button>
              </div>
              <Input id="nameDefault" name="nameDefault" ref={titleInputRef} />
              {titleGenError ? <p className="text-xs text-destructive">{titleGenError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" name="weight" type="number" step="0.0001" min="0" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className={fieldLabelClass}>Tags</Label>
              <Button type="button" variant="ghost" size="sm" disabled={tagsGenPending} onClick={handleGenerateTags}>
                <Sparkles className="size-3" />
                {tagsGenPending ? 'Generating…' : 'Generate Tags'}
              </Button>
            </div>
            <TagsField tags={tags} onTagsChange={setTags} />
            {tagsGenError ? <p className="mt-1 text-xs text-destructive">{tagsGenError}</p> : null}
          </div>
        </SectionCard>

        <AiProductAssistantCreate
          availableCategoryNames={availableCategoryNames}
          getContext={getContext}
          applyTitle={(title) => {
            if (titleInputRef.current) titleInputRef.current.value = title;
          }}
          applyDescription={(description) => {
            const el = fieldEl('description');
            if (el) el.value = description;
          }}
          applyTags={setTags}
          applyMetaTitle={(metaTitle) => {
            const el = fieldEl('meta_title');
            if (el) el.value = metaTitle;
          }}
          applyMetaDescription={(metaDescription) => {
            const el = fieldEl('meta_description');
            if (el) el.value = metaDescription;
          }}
        />
      </div>

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

      <SectionCard title="Tax">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="taxClassId">Tax Class</Label>
            <Select name="taxClassId" defaultValue="">
              <SelectTrigger id="taxClassId" className="w-full">
                <SelectValue placeholder="None (0% GST)" />
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
            <Input id="hsnCode" name="hsnCode" maxLength={8} placeholder="e.g. 61091000" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Attributes">
        <AttributeFieldsSection
          groups={[...DEFAULT_ATTRIBUTE_GROUPS, ...(selectedSetDetail?.groups ?? [])]}
          values={{}}
          renderFieldAction={renderDescriptionFieldAction}
        />
        {descGenError ? <p className="text-xs text-destructive">Description: {descGenError}</p> : null}
        {shortDescGenError ? <p className="text-xs text-destructive">Short Description: {shortDescGenError}</p> : null}
      </SectionCard>

      <SectionCard title="Categories">
        <CategoryPicker categories={categories} selectedIds={[]} />
      </SectionCard>

      <StickyFormActions pending={pending} label="Create Product" pendingLabel="Creating…" error={state.error} />
    </form>
  );
}

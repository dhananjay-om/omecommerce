'use client';

import { useActionState, useState } from 'react';
import { updateCategory, type ActionState } from './actions';
import { CategoryImageUploadField } from './category-image-upload-field';
import type { Category, CategorySortMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROOT_VALUE = '__root__';

const SORT_MODES: Array<{ value: CategorySortMode; label: string }> = [
  { value: 'POSITION', label: 'Manual position' },
  { value: 'NAME', label: 'Name' },
  { value: 'PRICE', label: 'Price' },
  { value: 'NEWEST', label: 'Newest first' },
];

/** Depth-prefixed labels ("— Laptops") so the flat picker still conveys the tree shape. */
function withDepthLabels(categories: Category[]): Array<{ publicId: string; label: string }> {
  const byId = new Map(categories.map((c) => [c.publicId, c]));
  function depthOf(c: Category): number {
    let depth = 0;
    let current = c.parentId ? byId.get(c.parentId) : undefined;
    while (current) {
      depth += 1;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return depth;
  }
  return categories.map((c) => ({
    publicId: c.publicId,
    label: `${'— '.repeat(depthOf(c))}${c.nameDefault ?? '(untitled)'}`,
  }));
}

/** A category can't become its own descendant's child — walk the tree from
 *  the category being edited and exclude itself plus everything under it
 *  from the parent picker. The backend also rejects this (ConflictError),
 *  this is just so the picker doesn't offer an option that will always fail. */
function excludeSelfAndDescendants(categories: Category[], selfId: string): Category[] {
  const excluded = new Set<string>([selfId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && excluded.has(c.parentId) && !excluded.has(c.publicId)) {
        excluded.add(c.publicId);
        grew = true;
      }
    }
  }
  return categories.filter((c) => !excluded.has(c.publicId));
}

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

const initialState: ActionState = { error: null, success: false };

/** A full page, not the old rename-only dialog — Category now has 9+ editable
 *  fields (name, parent, position, sort mode, menu visibility, image,
 *  description, 3 SEO fields), the same "outgrew the modal" reasoning already
 *  applied to Coupons this session. */
export function CategoryEditForm({ category, categories }: { category: Category; categories: Category[] }) {
  const [state, formAction, pending] = useActionState(updateCategory, initialState);
  const [parentId, setParentId] = useState(category.parentId ?? ROOT_VALUE);

  const options = withDepthLabels(excludeSelfAndDescendants(categories, category.publicId));

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <input type="hidden" name="publicId" value={category.publicId} />
      <input type="hidden" name="originalParentId" value={category.parentId ?? ''} />
      <input type="hidden" name="parentId" value={parentId === ROOT_VALUE ? '' : parentId} />

      <SectionCard title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input key={category.nameDefault ?? ''} id="cat-name" name="nameDefault" defaultValue={category.nameDefault ?? ''} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input id="cat-slug" value={category.slug} disabled />
            <p className="text-xs text-muted-foreground">Set at creation, not editable.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-parent">Parent</Label>
            <Select value={parentId} onValueChange={(value) => setParentId(String(value))}>
              <SelectTrigger id="cat-parent" className="w-full">
                <SelectValue placeholder="— Root —">
                  {(value: string | null) => (value === ROOT_VALUE || !value ? '— Root —' : options.find((o) => o.publicId === value)?.label)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_VALUE}>— Root —</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.publicId} value={o.publicId}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-position">Position</Label>
            {/* Keyed on the persisted value (not just publicId) — after a
             *  save, useActionState's post-action re-render can otherwise
             *  redisplay this uncontrolled input's stale mount-time
             *  defaultValue for a beat before settling. Same trick the old
             *  rename dialog used for its Name input. */}
            <Input key={category.position} id="cat-position" name="position" type="number" defaultValue={category.position} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-sortMode">Sort Mode</Label>
            <Select key={category.sortMode} name="sortMode" defaultValue={category.sortMode}>
              <SelectTrigger id="cat-sortMode" className="w-full">
                <SelectValue>{(value: string) => SORT_MODES.find((m) => m.value === value)?.label ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-includeInMenu">Include in Menu</Label>
            <Select key={String(category.includeInMenu)} name="includeInMenu" defaultValue={category.includeInMenu ? 'true' : 'false'}>
              <SelectTrigger id="cat-includeInMenu" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Yes — shown in storefront navigation' : 'No — hidden from storefront navigation')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes — shown in storefront navigation</SelectItem>
                <SelectItem value="false">No — hidden from storefront navigation</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Hiding a category also hides everything under it in the nav.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Listing">
        <CategoryImageUploadField
          key={category.imageMediaKey ?? ''}
          publicId={category.publicId}
          initialImageUrl={category.imageUrl}
          initialImageMediaKey={category.imageMediaKey}
        />
        <div className="space-y-2">
          <Label htmlFor="cat-description">Description</Label>
          <Textarea key={category.description ?? ''} id="cat-description" name="description" rows={5} defaultValue={category.description ?? ''} />
          <p className="text-xs text-muted-foreground">Shown above the product grid on this category&apos;s storefront page.</p>
        </div>
      </SectionCard>

      <SectionCard title="Search Engine Optimization">
        <div className="space-y-2">
          <Label htmlFor="cat-metaTitle">Meta Title</Label>
          <Input
            key={category.metaTitle ?? ''}
            id="cat-metaTitle"
            name="metaTitle"
            maxLength={255}
            defaultValue={category.metaTitle ?? ''}
            placeholder={category.nameDefault ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-metaDescription">Meta Description</Label>
          <Textarea key={category.metaDescription ?? ''} id="cat-metaDescription" name="metaDescription" rows={3} defaultValue={category.metaDescription ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-metaKeywords">Meta Keywords</Label>
          <Input
            key={category.metaKeywords ?? ''}
            id="cat-metaKeywords"
            name="metaKeywords"
            maxLength={255}
            defaultValue={category.metaKeywords ?? ''}
            placeholder="comma, separated, keywords"
          />
        </div>
      </SectionCard>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save Category'}
      </Button>
    </form>
  );
}

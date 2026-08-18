'use client';

import { useActionState, useState } from 'react';
import { createBanner, updateBanner, type ActionState } from './actions';
import { BannerImageUploadField } from './banner-image-upload-field';
import type { Banner, BannerGroup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const NO_GRADIENT = '__none__';

/** Fixed preset list — the admin picks one of these, never free text, so
 *  the stored value is always a known-good Tailwind gradient-utility
 *  string. Reuses the exact colors already hardcoded in
 *  promo-banners.tsx's DEFAULT_BANNERS / widget-renderer.tsx's
 *  DEFAULT_SLIDE_GRADIENTS (the fallback this field now lets an admin
 *  actually control), plus one new neutral option. */
const GRADIENT_PRESETS = [
  { value: 'from-blue-600 to-indigo-700', label: 'Blue → Indigo' },
  { value: 'from-rose-500 to-pink-600', label: 'Rose → Pink' },
  { value: 'from-amber-600 to-orange-700', label: 'Amber → Orange' },
  { value: 'from-emerald-600 to-teal-700', label: 'Emerald → Teal' },
  { value: 'from-indigo-600 to-violet-700', label: 'Indigo → Violet' },
  { value: 'from-rose-600 to-orange-600', label: 'Rose → Orange' },
  { value: 'from-primary to-blue-700', label: 'Primary → Blue' },
  { value: 'from-slate-700 to-slate-900', label: 'Slate (neutral)' },
];

function gradientLabel(value: string): string {
  if (value === NO_GRADIENT) return 'None (default rotation)';
  return GRADIENT_PRESETS.find((p) => p.value === value)?.label ?? value;
}

const initialState: ActionState = { error: null, success: false };

export function BannerForm({ banner }: { banner?: Banner }) {
  const isEdit = !!banner;
  const action = isEdit ? updateBanner : createBanner;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [group, setGroup] = useState<BannerGroup>(banner?.group ?? 'HERO');
  const [gradient, setGradient] = useState(banner?.gradient ?? NO_GRADIENT);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {isEdit ? <input type="hidden" name="publicId" value={banner.publicId} /> : null}

      <SectionCard title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="banner-group">Group</Label>
            <input type="hidden" name="group" value={group} />
            <Select value={group} onValueChange={(v) => setGroup((v as BannerGroup) ?? 'HERO')} disabled={isEdit}>
              <SelectTrigger id="banner-group" className="w-full">
                <SelectValue>{(value: string) => (value === 'HERO' ? 'Hero (top banner slider)' : 'Promo (sale banner grid)')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HERO">Hero (top banner slider)</SelectItem>
                <SelectItem value="PROMO">Promo (sale banner grid)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isEdit ? 'Set at creation, not editable.' : 'Which widget type this banner shows up in.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-title">Title</Label>
            <Input id="banner-title" name="title" defaultValue={banner?.title ?? ''} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-subtitle">Subtitle</Label>
            <Input id="banner-subtitle" name="subtitle" defaultValue={banner?.subtitle ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-position">Position</Label>
            <Input id="banner-position" name="position" type="number" defaultValue={banner?.position ?? 0} />
            <p className="text-xs text-muted-foreground">Lower numbers show first within the group.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-ctaLabel">Button Text</Label>
            <Input id="banner-ctaLabel" name="ctaLabel" defaultValue={banner?.ctaLabel ?? ''} placeholder="Shop Now" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-ctaHref">Button Link</Label>
            <Input id="banner-ctaHref" name="ctaHref" defaultValue={banner?.ctaHref ?? ''} placeholder="/products" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-isActive">Active</Label>
            <Select name="isActive" defaultValue={(banner?.isActive ?? true) ? 'true' : 'false'}>
              <SelectTrigger id="banner-isActive" className="w-full">
                <SelectValue>{(value: string) => (value === 'true' ? 'Yes — shown on the storefront' : 'No — hidden')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes — shown on the storefront</SelectItem>
                <SelectItem value="false">No — hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Image">
        <BannerImageUploadField group={group} initialImageUrl={banner?.imageUrl ?? null} initialImageMediaKey={banner?.imageMediaKey ?? null} />
      </SectionCard>

      <SectionCard title="Backdrop Color">
        <div className="space-y-2">
          <Label htmlFor="banner-gradient">Gradient</Label>
          <input type="hidden" name="gradient" value={gradient === NO_GRADIENT ? '' : gradient} />
          <Select value={gradient} onValueChange={(v) => setGradient(v ?? NO_GRADIENT)}>
            <SelectTrigger id="banner-gradient" className="w-full">
              <SelectValue>{(value: string) => gradientLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GRADIENT}>None (default rotation)</SelectItem>
              {GRADIENT_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Used as the backdrop when no image is uploaded above.</p>
        </div>
      </SectionCard>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : isEdit ? 'Save Banner' : 'Create Banner'}
      </Button>
    </form>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { createWidget, updateWidget, type ActionState } from './actions';
import { CmsBlockConfigField, LimitConfigField, WhyChooseUsConfigField, TestimonialConfigField } from './widget-config-fields';
import type { WidgetInstance, WidgetType, WidgetSection, CmsBlock } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPE_LABELS: Record<WidgetType, string> = {
  CMS_BLOCK: 'CMS Block',
  HERO_BANNER_SLIDER: 'Hero Banner Slider',
  PROMO_BANNER_GRID: 'Promo Banner Grid (Sale Banners)',
  CATEGORY_GRID: 'Category Grid (Shop by Category)',
  BRAND_GRID: 'Brand Grid (Top Brands)',
  WHY_CHOOSE_US_LIST: 'Why Choose Us',
  TESTIMONIAL_LIST: 'Testimonials',
};

const SECTION_LABELS: Record<WidgetSection, string> = { TOP: 'Top', MIDDLE: 'Middle', FOOTER: 'Footer' };

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

function defaultConfigFor(type: WidgetType): Record<string, unknown> {
  switch (type) {
    case 'CMS_BLOCK':
      return { code: '' };
    case 'WHY_CHOOSE_US_LIST':
      return { features: [{ icon: 'truck', title: '', description: '' }] };
    case 'TESTIMONIAL_LIST':
      return { testimonials: [{ name: '', quote: '' }] };
    default:
      return {};
  }
}

const initialState: ActionState = { error: null, success: false };

export function WidgetForm({ widget, blocks }: { widget?: WidgetInstance; blocks: CmsBlock[] }) {
  const isEdit = !!widget;
  const action = isEdit ? updateWidget : createWidget;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [type, setType] = useState<WidgetType>(widget?.type ?? 'CMS_BLOCK');
  const [config, setConfig] = useState<Record<string, unknown>>(widget?.config ?? defaultConfigFor(type));

  function handleTypeChange(next: WidgetType) {
    setType(next);
    setConfig(defaultConfigFor(next));
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {isEdit ? <input type="hidden" name="publicId" value={widget.publicId} /> : null}
      <input type="hidden" name="configJson" value={JSON.stringify(config)} />

      <SectionCard title="Basic Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="widget-type">Type</Label>
            {isEdit ? (
              <Input id="widget-type" value={TYPE_LABELS[type]} disabled />
            ) : (
              <>
                <input type="hidden" name="type" value={type} />
                <Select value={type} onValueChange={(v) => handleTypeChange((v as WidgetType) ?? 'CMS_BLOCK')}>
                  <SelectTrigger id="widget-type" className="w-full">
                    <SelectValue>{(value: WidgetType) => TYPE_LABELS[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as WidgetType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <p className="text-xs text-muted-foreground">{isEdit ? 'Set at creation, not editable.' : 'What this widget renders.'}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="widget-section">Section</Label>
            <Select name="section" defaultValue={widget?.section ?? 'TOP'}>
              <SelectTrigger id="widget-section" className="w-full">
                <SelectValue>{(value: WidgetSection) => SECTION_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SECTION_LABELS) as WidgetSection[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SECTION_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Which home page zone this widget appears in.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="widget-position">Position</Label>
            <Input id="widget-position" name="position" type="number" defaultValue={widget?.position ?? 0} />
            <p className="text-xs text-muted-foreground">Lower numbers show first within the section.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="widget-title">Heading (optional)</Label>
            <Input id="widget-title" name="title" defaultValue={widget?.title ?? ''} placeholder="Shop by Category" />
          </div>
          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="widget-isActive">Active</Label>
              <Select name="isActive" defaultValue={widget.isActive ? 'true' : 'false'}>
                <SelectTrigger id="widget-isActive" className="w-full">
                  <SelectValue>{(value: string) => (value === 'true' ? 'Yes — shown on the storefront' : 'No — hidden')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes — shown on the storefront</SelectItem>
                  <SelectItem value="false">No — hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Configuration">
        {type === 'CMS_BLOCK' ? (
          <CmsBlockConfigField blocks={blocks} code={(config.code as string) ?? ''} onChange={(code) => setConfig({ code })} />
        ) : type === 'HERO_BANNER_SLIDER' ? (
          <LimitConfigField
            limit={config.limit ? String(config.limit) : ''}
            onChange={(v) => setConfig({ limit: v ? Number(v) : undefined })}
            note="Pulls active banners from Content > Banners (group: Hero), ordered by their own Position."
          />
        ) : type === 'PROMO_BANNER_GRID' ? (
          <LimitConfigField
            limit={config.limit ? String(config.limit) : ''}
            onChange={(v) => setConfig({ limit: v ? Number(v) : undefined })}
            note="Pulls active banners from Content > Banners (group: Promo), ordered by their own Position."
          />
        ) : type === 'CATEGORY_GRID' ? (
          <LimitConfigField
            limit={config.limit ? String(config.limit) : ''}
            onChange={(v) => setConfig({ limit: v ? Number(v) : undefined })}
            note="Pulls root categories, ordered by their own Position."
          />
        ) : type === 'BRAND_GRID' ? (
          <LimitConfigField
            limit={config.limit ? String(config.limit) : ''}
            onChange={(v) => setConfig({ limit: v ? Number(v) : undefined })}
            note="Pulls brands."
          />
        ) : type === 'WHY_CHOOSE_US_LIST' ? (
          <WhyChooseUsConfigField
            features={(config.features as Array<{ icon: string; title: string; description: string }>) ?? []}
            onChange={(features) => setConfig({ features })}
          />
        ) : (
          <TestimonialConfigField
            testimonials={(config.testimonials as Array<{ name: string; quote: string }>) ?? []}
            onChange={(testimonials) => setConfig({ testimonials })}
          />
        )}
      </SectionCard>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : isEdit ? 'Save Widget' : 'Create Widget'}
      </Button>
    </form>
  );
}

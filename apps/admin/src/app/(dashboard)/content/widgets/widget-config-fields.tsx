'use client';

import { X } from 'lucide-react';
import type { CmsBlock } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Fixed allowlist matching the storefront's WHY_CHOOSE_US_LIST icon map
 *  (apps/storefront/.../why-choose-us.tsx) — icon components obviously
 *  can't be stored in the DB, so config only carries this key. */
const ICON_OPTIONS = [
  { value: 'truck', label: 'Truck (Shipping)' },
  { value: 'shield', label: 'Shield (Security)' },
  { value: 'refresh', label: 'Refresh (Returns)' },
  { value: 'chat', label: 'Chat (Support)' },
];

export function CmsBlockConfigField({ blocks, code, onChange }: { blocks: CmsBlock[]; code: string; onChange: (code: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="widget-cms-block">Block</Label>
      <Select value={code} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger id="widget-cms-block" className="w-full">
          <SelectValue placeholder="Select a block">{(value: string | null) => blocks.find((b) => b.code === value)?.code ?? 'Select a block'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {blocks.map((b) => (
            <SelectItem key={b.code} value={b.code}>
              {b.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Renders that block&apos;s raw HTML in place. Manage the block&apos;s own content under Content &gt; Blocks.
      </p>
    </div>
  );
}

export function LimitConfigField({ limit, onChange, note }: { limit: string; onChange: (limit: string) => void; note: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="widget-limit">Limit (optional)</Label>
      <Input id="widget-limit" type="number" min={1} value={limit} onChange={(e) => onChange(e.target.value)} placeholder="No limit" />
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

interface FeatureRow {
  icon: string;
  title: string;
  description: string;
}

export function WhyChooseUsConfigField({ features, onChange }: { features: FeatureRow[]; onChange: (features: FeatureRow[]) => void }) {
  function updateRow(i: number, patch: Partial<FeatureRow>) {
    onChange(features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  return (
    <div className="space-y-3">
      <Label>Features</Label>
      {features.map((f, i) => (
        <div key={i} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Row {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove row"
              disabled={features.length === 1}
              onClick={() => onChange(features.filter((_, idx) => idx !== i))}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Icon</Label>
              <Select value={f.icon} onValueChange={(v) => updateRow(i, { icon: v ?? 'truck' })}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => ICON_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={f.title} onChange={(e) => updateRow(i, { title: e.target.value })} placeholder="Free Shipping" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={f.description} onChange={(e) => updateRow(i, { description: e.target.value })} placeholder="On all orders over $50" />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...features, { icon: 'truck', title: '', description: '' }])}>
        Add Feature
      </Button>
    </div>
  );
}

interface TestimonialRow {
  name: string;
  quote: string;
}

export function TestimonialConfigField({ testimonials, onChange }: { testimonials: TestimonialRow[]; onChange: (testimonials: TestimonialRow[]) => void }) {
  function updateRow(i: number, patch: Partial<TestimonialRow>) {
    onChange(testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  return (
    <div className="space-y-3">
      <Label>Testimonials</Label>
      {testimonials.map((t, i) => (
        <div key={i} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Row {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove row"
              disabled={testimonials.length === 1}
              onClick={() => onChange(testimonials.filter((_, idx) => idx !== i))}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Customer Name</Label>
              <Input value={t.name} onChange={(e) => updateRow(i, { name: e.target.value })} placeholder="Amara K." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quote</Label>
              <Textarea rows={2} value={t.quote} onChange={(e) => updateRow(i, { quote: e.target.value })} placeholder="Fast shipping and..." />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...testimonials, { name: '', quote: '' }])}>
        Add Testimonial
      </Button>
    </div>
  );
}

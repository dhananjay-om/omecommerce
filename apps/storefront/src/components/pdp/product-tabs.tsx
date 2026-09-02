'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function formatLabel(code: string): string {
  return code.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Codes that are either shown elsewhere on the PDP (description, short description) or exist
 * purely for SEO metadata (<head> tags, never visible page content) — never listed as a spec. */
const NON_SPEC_CODES = new Set(['description', 'short_description', 'url_key', 'meta_title', 'meta_keywords', 'meta_description']);

/** Static store policy copy, matching the reference theme's Shipping/Returns
 *  tabs — this store has no per-product or admin-configurable shipping/
 *  returns content system, so these are genuinely static, same posture as
 *  the trust badges and footer's own policy copy elsewhere on the site. */
const SHIPPING_RETURNS_ITEMS = [
  'Free standard delivery on orders above $50',
  'Express delivery (1–2 days) available at checkout',
  'International shipping to select countries',
  'Orders placed before 2pm ship same day',
  'Free returns within 30 days of delivery',
  'Item must be unused, in original packaging, with tags',
  'Start a return from your account anytime',
  'Refund processed within 5 working days',
];

export function ProductTabs({
  sku,
  description,
  attributes,
}: {
  sku: string;
  description: string | null;
  attributes: Record<string, unknown>;
}) {
  const specEntries = Object.entries(attributes).filter(
    ([code, value]) => !NON_SPEC_CODES.has(code) && value !== null && value !== undefined && value !== '',
  );

  return (
    <Tabs defaultValue="description">
      <TabsList>
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="specifications">Specifications</TabsTrigger>
        <TabsTrigger value="shipping">Shipping &amp; Returns</TabsTrigger>
      </TabsList>
      <TabsContent value="description" className="pt-4 text-charcoal">
        {description ? <p className="whitespace-pre-line">{description}</p> : <p>No description available for SKU {sku} yet.</p>}
      </TabsContent>
      <TabsContent value="specifications" className="pt-4">
        {specEntries.length === 0 ? (
          <p className="text-slate">No additional specifications for this product.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {specEntries.map(([code, value]) => (
              <div key={code} className="flex justify-between border-b border-ghost py-1.5 text-sm">
                <dt className="text-slate">{formatLabel(code)}</dt>
                <dd className="font-medium text-jet">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </TabsContent>
      <TabsContent value="shipping" className="pt-4">
        <ul className="flex flex-col gap-2.5">
          {SHIPPING_RETURNS_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-charcoal">
              <span className="mt-0.5 shrink-0 text-champagne">·</span>
              {item}
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}

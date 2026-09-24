'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Fallback copy for the Shipping & Returns tab — shown only when the admin
 *  hasn't created (or has unpublished) the `pdp_shipping_returns` block in
 *  Content > Blocks, which is what normally supplies this tab's content. */
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
  specifications,
  shippingReturnsHtml,
}: {
  sku: string;
  description: string | null;
  /** Real attribute labels + display-ready values, already filtered to those marked visible on the product page. */
  specifications: Array<{ code: string; label: string; value: string }>;
  /** Admin-managed (Content > Blocks > `pdp_shipping_returns`); null → the built-in fallback list. */
  shippingReturnsHtml: string | null;
}) {
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
        {specifications.length === 0 ? (
          <p className="text-slate">No additional specifications for this product.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {specifications.map((spec) => (
              <div key={spec.code} className="flex justify-between gap-4 border-b border-ghost py-1.5 text-sm">
                <dt className="text-slate">{spec.label}</dt>
                <dd className="text-right font-medium text-jet">{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </TabsContent>
      <TabsContent value="shipping" className="pt-4">
        {shippingReturnsHtml ? (
          <div
            className="text-sm text-charcoal [&_a]:text-champagne [&_a]:underline [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: shippingReturnsHtml }}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {SHIPPING_RETURNS_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-charcoal">
                <span className="mt-0.5 shrink-0 text-champagne">·</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

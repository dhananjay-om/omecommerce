'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductReviews } from './product-reviews';
import type { ProductReviewList } from '@/types/review';

function formatLabel(code: string): string {
  return code.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Codes that are either shown elsewhere on the PDP (description, short description) or exist
 * purely for SEO metadata (<head> tags, never visible page content) — never listed as a spec. */
const NON_SPEC_CODES = new Set(['description', 'short_description', 'url_key', 'meta_title', 'meta_keywords', 'meta_description']);

export function ProductTabs({
  productId,
  sku,
  description,
  attributes,
  reviews,
}: {
  productId: string;
  sku: string;
  description: string | null;
  attributes: Record<string, unknown>;
  reviews: ProductReviewList;
}) {
  const specEntries = Object.entries(attributes).filter(
    ([code, value]) => !NON_SPEC_CODES.has(code) && value !== null && value !== undefined && value !== '',
  );

  return (
    <Tabs defaultValue="description">
      <TabsList>
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="specifications">Specifications</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
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
      <TabsContent value="reviews" className="pt-4">
        <ProductReviews productId={productId} initialReviews={reviews} />
      </TabsContent>
    </Tabs>
  );
}

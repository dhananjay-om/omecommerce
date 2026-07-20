'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function formatLabel(code: string): string {
  return code.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProductTabs({ sku, attributes }: { sku: string; attributes: Record<string, unknown> }) {
  const specEntries = Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <Tabs defaultValue="description" className="mt-10">
      <TabsList>
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="specifications">Specifications</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
      </TabsList>
      <TabsContent value="description" className="pt-4 text-muted-foreground">
        <p>Product details for SKU {sku}.</p>
      </TabsContent>
      <TabsContent value="specifications" className="pt-4">
        {specEntries.length === 0 ? (
          <p className="text-muted-foreground">No additional specifications for this product.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {specEntries.map(([code, value]) => (
              <div key={code} className="flex justify-between border-b py-1.5 text-sm">
                <dt className="text-muted-foreground">{formatLabel(code)}</dt>
                <dd className="font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </TabsContent>
      {/* Reviews UI-only for now — no review backend exists (plan/14 context). */}
      <TabsContent value="reviews" className="pt-4 text-muted-foreground">
        <p>No reviews yet. Be the first to review this product.</p>
      </TabsContent>
    </Tabs>
  );
}

import type { SearchHit } from '@/types/product';
import { ProductCard } from '@/components/product/product-card';

export function ProductGrid({ hits }: { hits: SearchHit[] }) {
  if (hits.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <p className="font-medium">No products found</p>
        <p className="mt-1 text-sm text-muted-foreground">Try adjusting or clearing your filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {hits.map((hit) => (
        <ProductCard key={hit.productId} hit={hit} />
      ))}
    </div>
  );
}

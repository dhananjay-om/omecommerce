import type { SearchHit } from '@/types/product';
import { ProductCard } from '@/components/product/product-card';

export function ProductGrid({ hits }: { hits: SearchHit[] }) {
  if (hits.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-ghost py-20 text-center">
        <p className="font-medium text-jet">No products found</p>
        <p className="mt-1 text-sm text-slate">Try adjusting or clearing your filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {hits.map((hit) => (
        <ProductCard key={hit.productId} hit={hit} />
      ))}
    </div>
  );
}

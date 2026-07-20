import Link from 'next/link';
import type { Brand } from '@/types/category';

/** Real data (Phase 0b) — brands carry no logo yet, so this is a name-badge grid rather than a logo carousel. */
export function TopBrands({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null;

  return (
    <section className="bg-muted/40 py-10">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-4 text-xl font-bold sm:text-2xl">Top Brands</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {brands.slice(0, 10).map((brand) => (
            <Link
              key={brand.publicId}
              href={`/brands/${brand.slug}`}
              className="flex items-center justify-center rounded-lg border bg-background px-4 py-6 text-center text-sm font-semibold transition-shadow hover:shadow-md"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

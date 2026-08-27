import Link from 'next/link';
import type { Brand } from '@/types/category';

/** Real data (Phase 0b) — brands carry no logo yet, so this is a name-badge
 *  grid rather than a logo carousel. `brands` is exactly the list to
 *  render, already filtered/curated/limited by the caller
 *  (widget-renderer.tsx). `heading` is an optional override fed by a
 *  BRAND_GRID widget instance (Content > Widgets); omit it for the
 *  original default. */
export function TopBrands({ brands, heading }: { brands: Brand[]; heading?: string }) {
  if (brands.length === 0) return null;

  return (
    <section className="bg-ivory py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display mb-6 text-2xl font-semibold text-jet sm:text-3xl">{heading ?? 'Top Brands'}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {brands.map((brand) => (
            <Link
              key={brand.publicId}
              href={`/brands/${brand.slug}`}
              className="flex items-center justify-center rounded-2xl bg-white px-4 py-7 text-center text-sm font-semibold text-charcoal ring-1 ring-ghost transition-colors hover:text-champagne hover:ring-champagne"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

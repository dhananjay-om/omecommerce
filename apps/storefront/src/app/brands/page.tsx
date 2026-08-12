import Link from 'next/link';
import type { Metadata } from 'next';
import { listBrands } from '@/services/brand.service';

export const metadata: Metadata = { title: 'Brands' };

export default async function BrandsPage() {
  const brands = await listBrands();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Brands</h1>
      {brands.length === 0 ? (
        <p className="text-muted-foreground">No brands available yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {brands.map((brand) => (
            <Link
              key={brand.publicId}
              href={`/brands/${brand.slug}`}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-background px-4 py-8 text-center transition-shadow hover:shadow-md"
            >
              <span className="text-lg font-semibold">{brand.name}</span>
              {brand.description ? <span className="line-clamp-2 text-xs text-muted-foreground">{brand.description}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

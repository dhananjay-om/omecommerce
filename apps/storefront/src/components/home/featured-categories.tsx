import Link from 'next/link';
import type { Category } from '@/types/category';
import { categoryPhoto } from '@/lib/mock-images';

/** Real data (Phase 0a) — shown as circular photo tiles, using each
 *  category's own uploaded image (Categories admin) when set, falling back
 *  to a curated stock photo per category slug (see lib/mock-images.ts) —
 *  every category's `imageUrl` is null today, no admin has uploaded one
 *  yet. `categories` is exactly the list to render, already
 *  filtered/curated/limited by the caller (widget-renderer.tsx — default
 *  behavior is root categories only; an explicit curated pick can include
 *  any category, so this component doesn't re-filter by parentId itself).
 *  `heading` is an optional override fed by a CATEGORY_GRID widget instance
 *  (Content > Widgets); omit it to get the original default. */
export function FeaturedCategories({ categories, heading }: { categories: Category[]; heading?: string }) {
  if (categories.length === 0) return null;

  return (
    <section className="bg-ivory py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-champagne uppercase">Start exploring</p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-jet sm:text-4xl">{heading ?? 'Shop by Category'}</h2>
          <p className="mt-2 text-sm text-slate">Everything you need, right where you want it.</p>
        </div>

        <div className="flex flex-nowrap justify-center gap-4 overflow-x-auto pb-2 sm:gap-6 lg:gap-10">
          {categories.map((category) => (
            <Link key={category.publicId} href={`/collections/${category.slug}`} className="group flex shrink-0 flex-col items-center gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-transparent transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:ring-champagne group-hover:ring-offset-2 sm:h-28 sm:w-28 lg:h-36 lg:w-36">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL when real, curated stock photo otherwise */}
                <img
                  src={category.imageUrl ?? categoryPhoto(category.slug)}
                  alt={category.nameDefault ?? category.slug}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <span className="text-center text-sm font-semibold text-charcoal transition-colors group-hover:text-champagne sm:text-base">
                {category.nameDefault ?? category.slug}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';
import type { Category } from '@/types/category';

/** Real data (Phase 0a) — shown as cards, using each category's own uploaded
 *  image (Categories admin) when set, falling back to a letter badge when
 *  not. `categories` is exactly the list to render, already
 *  filtered/curated/limited by the caller (widget-renderer.tsx — default
 *  behavior is root categories only; an explicit curated pick can include
 *  any category, so this component doesn't re-filter by parentId itself).
 *  `heading` is an optional override fed by a CATEGORY_GRID widget instance
 *  (Content > Widgets); omit it to get the original default. */
export function FeaturedCategories({ categories, heading }: { categories: Category[]; heading?: string }) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h2 className="font-display mb-6 text-2xl font-semibold text-jet sm:text-3xl">{heading ?? 'Shop by Category'}</h2>
      <div className="flex gap-6 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 md:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.publicId}
            href={`/collections/${category.slug}`}
            className="group flex shrink-0 flex-col items-center gap-3 text-center"
          >
            <span className="ring-offset-background overflow-hidden rounded-full ring-1 ring-ghost transition-all group-hover:ring-2 group-hover:ring-champagne group-hover:ring-offset-2">
              {category.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL, per-request/dynamic
                <img src={category.imageUrl} alt="" className="size-24 object-cover sm:size-28" />
              ) : (
                <span className="flex size-24 items-center justify-center bg-sand text-2xl font-semibold text-champagne sm:size-28">
                  {(category.nameDefault ?? category.slug).charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="text-sm font-medium text-charcoal transition-colors group-hover:text-champagne">
              {category.nameDefault ?? category.slug}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

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
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h2 className="mb-4 text-xl font-bold sm:text-2xl">{heading ?? 'Shop by Category'}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.publicId}
            href={`/collections/${category.slug}`}
            className="group flex flex-col items-center gap-3 rounded-lg border bg-background p-6 text-center transition-shadow hover:shadow-md"
          >
            {category.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL, per-request/dynamic
              <img src={category.imageUrl} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {(category.nameDefault ?? category.slug).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-sm font-medium group-hover:text-primary">{category.nameDefault ?? category.slug}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

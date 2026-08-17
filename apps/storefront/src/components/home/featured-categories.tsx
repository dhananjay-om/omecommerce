import Link from 'next/link';
import type { Category } from '@/types/category';

/** Real data (Phase 0a) — the root-level categories, shown as simple link cards since categories carry no image of their own yet.
 *  `heading`/`limit` are optional overrides fed by a CATEGORY_GRID widget instance (Content > Widgets); omit both to get the original defaults. */
export function FeaturedCategories({ categories, heading, limit }: { categories: Category[]; heading?: string; limit?: number }) {
  const allRoots = categories.filter((c) => c.parentId === null);
  const roots = limit ? allRoots.slice(0, limit) : allRoots;
  if (roots.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h2 className="mb-4 text-xl font-bold sm:text-2xl">{heading ?? 'Shop by Category'}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {roots.map((category) => (
          <Link
            key={category.publicId}
            href={`/collections/${category.slug}`}
            className="group flex flex-col items-center gap-3 rounded-lg border bg-background p-6 text-center transition-shadow hover:shadow-md"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {(category.nameDefault ?? category.slug).charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium group-hover:text-primary">{category.nameDefault ?? category.slug}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

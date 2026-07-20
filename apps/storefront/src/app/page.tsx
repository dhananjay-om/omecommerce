import Link from 'next/link';
import { listCategories } from '@/services/category.service';

/** Placeholder shell for Phase 1 — the real 12-section home page is Phase 2. */
export default async function HomePage() {
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-bold">Welcome to OMEShop</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        The full storefront experience is under construction. Browse categories below in the meantime.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {categories
          .filter((c) => c.parentId === null)
          .map((c) => (
            <Link
              key={c.publicId}
              href={`/collections/${c.slug}`}
              className="rounded-full border px-4 py-2 text-sm hover:bg-muted"
            >
              {c.nameDefault ?? c.slug}
            </Link>
          ))}
      </div>
    </div>
  );
}

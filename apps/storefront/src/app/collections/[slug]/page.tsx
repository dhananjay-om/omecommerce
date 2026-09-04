import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategory, listCategories } from '@/services/category.service';
import { listBrands } from '@/services/brand.service';
import { searchProducts } from '@/services/products.service';
import { ApiError } from '@/lib/api-client';
import { normalizeSearchParams, toSearchServiceParams } from '@/lib/plp-query';
import { CATEGORY_FACET_CODE } from '@/lib/facet-codes';
import { PlpShell } from '@/components/plp/plp-shell';
import type { CategoryNav } from '@/components/plp/filter-sidebar';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { category } = await getCategory(slug);
    const fallbackTitle = category.nameDefault ?? category.slug;
    const title = category.metaTitle ?? fallbackTitle;
    const description = category.metaDescription ?? category.description ?? undefined;
    const keywords = category.metaKeywords
      ? category.metaKeywords.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined;
    const image = category.imageUrl ?? undefined;
    return {
      title,
      description,
      keywords,
      openGraph: {
        title,
        description,
        type: 'website',
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {};
  }
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const plpParams = normalizeSearchParams(await searchParams);

  let categoryData;
  try {
    categoryData = await getCategory(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { category, breadcrumb } = categoryData;

  const [result, brands, allCategories] = await Promise.all([
    searchProducts(toSearchServiceParams(plpParams, { extraFilter: { [CATEGORY_FACET_CODE]: category.publicId } })),
    listBrands(),
    listCategories(),
  ]);

  // Theme reference (`ProductListing.tsx`) shows a row of subcategory pills
  // next to the hero title when browsing a parent category — real children,
  // not a mock, sorted the same way the mega-menu already sorts siblings.
  const subcategories = allCategories
    .filter((c) => c.parentId === category.publicId)
    .sort((a, b) => a.position - b.position);

  // Sidebar "Category" list (theme's own Filters component) — "All {parent}"
  // + every sibling under it. When the current category itself has children,
  // it's its own "family parent" (matches theme browsing a top-level
  // category); otherwise its real parent (from the breadcrumb) is. A
  // category with neither (a standalone top-level leaf) gets no section —
  // nothing real to list, same "don't pad with nothing real" posture as
  // `subcategories` above.
  const familyParent = subcategories.length > 0 ? category : (breadcrumb.at(-1) ?? null);
  const categoryNav: CategoryNav | undefined = familyParent
    ? {
        parentLabel: familyParent.nameDefault ?? familyParent.slug,
        parentHref: `/collections/${familyParent.slug}`,
        parentActive: category.publicId === familyParent.publicId,
        items: allCategories
          .filter((c) => c.parentId === familyParent.publicId)
          .sort((a, b) => a.position - b.position)
          .map((c) => ({
            publicId: c.publicId,
            slug: c.slug,
            label: c.nameDefault ?? c.slug,
            active: c.publicId === category.publicId,
          })),
      }
    : undefined;

  return (
    <PlpShell
      basePath={`/collections/${slug}`}
      params={plpParams}
      heading={category.nameDefault ?? category.slug}
      result={result}
      brands={brands}
      breadcrumb={breadcrumb}
      banner={{ imageUrl: category.imageUrl, description: category.description }}
      subcategories={subcategories}
      categoryNav={categoryNav}
    />
  );
}

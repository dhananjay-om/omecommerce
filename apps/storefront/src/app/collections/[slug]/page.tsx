import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategory } from '@/services/category.service';
import { listBrands } from '@/services/brand.service';
import { searchProducts } from '@/services/products.service';
import { ApiError } from '@/lib/api-client';
import { normalizeSearchParams, toSearchServiceParams } from '@/lib/plp-query';
import { CATEGORY_FACET_CODE } from '@/lib/facet-codes';
import { PlpShell } from '@/components/plp/plp-shell';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { category } = await getCategory(slug);
    return { title: category.nameDefault ?? category.slug };
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

  const [result, brands] = await Promise.all([
    searchProducts(toSearchServiceParams(plpParams, { extraFilter: { [CATEGORY_FACET_CODE]: category.publicId } })),
    listBrands(),
  ]);

  return (
    <PlpShell
      basePath={`/collections/${slug}`}
      params={plpParams}
      heading={category.nameDefault ?? category.slug}
      result={result}
      brands={brands}
      breadcrumb={breadcrumb}
    />
  );
}

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBrand, listBrands } from '@/services/brand.service';
import { searchProducts } from '@/services/products.service';
import { ApiError } from '@/lib/api-client';
import { normalizeSearchParams, toSearchServiceParams } from '@/lib/plp-query';
import { BRAND_FACET_CODE } from '@/lib/facet-codes';
import { PlpShell } from '@/components/plp/plp-shell';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const brand = await getBrand(slug);
    return { title: brand.name, description: brand.description ?? undefined };
  } catch {
    return {};
  }
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const plpParams = normalizeSearchParams(await searchParams);

  let brand;
  try {
    brand = await getBrand(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [result, brands] = await Promise.all([
    searchProducts(toSearchServiceParams(plpParams, { extraFilter: { [BRAND_FACET_CODE]: brand.publicId } })),
    listBrands(),
  ]);

  return <PlpShell basePath={`/brands/${slug}`} params={plpParams} heading={brand.name} result={result} brands={brands} />;
}

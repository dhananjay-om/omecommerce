import type { Metadata } from 'next';
import { listBrands } from '@/services/brand.service';
import { searchProducts } from '@/services/products.service';
import { normalizeSearchParams, toSearchServiceParams } from '@/lib/plp-query';
import { PlpShell } from '@/components/plp/plp-shell';

export const metadata: Metadata = { title: 'All Products' };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const plpParams = normalizeSearchParams(await searchParams);

  const [result, brands] = await Promise.all([searchProducts(toSearchServiceParams(plpParams)), listBrands()]);

  return <PlpShell basePath="/products" params={plpParams} heading="All Products" result={result} brands={brands} />;
}

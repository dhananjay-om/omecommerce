import type { Metadata } from 'next';
import { listBrands } from '@/services/brand.service';
import { searchProducts } from '@/services/products.service';
import { normalizeSearchParams, toSearchServiceParams } from '@/lib/plp-query';
import { PlpShell } from '@/components/plp/plp-shell';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const query = Array.isArray(q) ? q[0] : q;
  return { title: query ? `Search: ${query}` : 'Search' };
}

export default async function SearchPage({ searchParams }: Props) {
  const plpParams = normalizeSearchParams(await searchParams);
  const q = plpParams.q;

  const [result, brands] = await Promise.all([searchProducts(toSearchServiceParams(plpParams, { q })), listBrands()]);

  return (
    <PlpShell
      basePath="/search"
      params={plpParams}
      heading={q ? `Search results for "${q}"` : 'Search'}
      result={result}
      brands={brands}
    />
  );
}

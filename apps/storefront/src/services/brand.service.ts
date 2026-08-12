import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { Brand } from '@/types/category';

/** Server Component reads only — direct to Express. Not in the originally requested file list, but needed for the "Top Brands" home section and a brand-filtered PLP. */
export function listBrands(): Promise<Brand[]> {
  return apiGet<Brand[]>('/store/v1/brands');
}

export function getBrand(slug: string): Promise<Brand> {
  return apiGet<Brand>(`/store/v1/brands/${slug}`);
}

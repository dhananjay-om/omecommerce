import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { Category, CategoryWithBreadcrumb } from '@/types/category';

/** Server Component reads only — direct to Express. */
export function listCategories(): Promise<Category[]> {
  return apiGet<Category[]>('/store/v1/categories');
}

export function getCategory(slug: string): Promise<CategoryWithBreadcrumb> {
  return apiGet<CategoryWithBreadcrumb>(`/store/v1/categories/${slug}`);
}

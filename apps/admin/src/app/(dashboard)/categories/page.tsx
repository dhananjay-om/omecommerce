import { apiGet } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { CategoryTree } from './category-tree';
import { NewCategoryDialog } from './new-category-dialog';

export default async function CategoriesPage() {
  const categories = await apiGet<Category[]>('/admin/v1/categories');

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <NewCategoryDialog categories={categories} />
      </div>

      <div className="mt-6">
        <CategoryTree categories={categories} />
      </div>
    </div>
  );
}

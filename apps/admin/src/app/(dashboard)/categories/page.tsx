import { apiGet } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { CategoryTree } from './category-tree';
import { NewCategoryDialog } from './new-category-dialog';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { NavTabs } from '@/components/nav-tabs';

export default async function CategoriesPage() {
  const categories = await apiGet<Category[]>('/admin/v1/categories');

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/categories' }, { label: 'Categories' }]} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Categories</h1>
          {/* Mock's own subtitle promises "product counts" too — dropped
              here since there's no per-category product count in this
              API yet (no categoryId filter on the products list, no
              count field on categories) and this session's discipline is
              not to show a number that isn't real. */}
          <p className="mt-1 text-sm text-muted-foreground">Nested category tree with visibility settings</p>
        </div>
        <NewCategoryDialog categories={categories} />
      </div>

      <div className="mt-6">
        <NavTabs
          items={[
            { href: '/categories', label: 'Category Tree' },
            { href: '/categories/collections', label: 'Collections' },
          ]}
        />
        <div className="mt-6">
          <CategoryTree categories={categories} />
        </div>
      </div>
    </div>
  );
}

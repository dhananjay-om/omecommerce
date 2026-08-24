import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { CategoryEditForm } from '../../category-edit-form';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // No standalone GET /admin/v1/categories/:publicId — the tree is admin-scale
  // (same reasoning already used for coupons/[code]/edit), so filtering the
  // list is simpler than adding a new endpoint just for this page.
  const categories = await apiGet<Category[]>('/admin/v1/categories');
  const category = categories.find((c) => c.publicId === id);
  if (!category) notFound();
  const name = category.nameDefault ?? '(untitled)';

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/categories' }, { label: 'Categories', href: '/categories' }, { label: name }]} />
      <h1 className="mt-2 text-[1.32rem] font-extrabold tracking-tight">{name}</h1>
      <div className="mt-6">
        <CategoryEditForm category={category} categories={categories} />
      </div>
    </div>
  );
}

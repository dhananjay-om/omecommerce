import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { CategoryEditForm } from '../../category-edit-form';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // No standalone GET /admin/v1/categories/:publicId — the tree is admin-scale
  // (same reasoning already used for coupons/[code]/edit), so filtering the
  // list is simpler than adding a new endpoint just for this page.
  const categories = await apiGet<Category[]>('/admin/v1/categories');
  const category = categories.find((c) => c.publicId === id);
  if (!category) notFound();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Category — {category.nameDefault ?? '(untitled)'}</h1>
      <div className="mt-6">
        <CategoryEditForm category={category} categories={categories} />
      </div>
    </div>
  );
}

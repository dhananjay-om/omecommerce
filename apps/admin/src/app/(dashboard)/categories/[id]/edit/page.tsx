import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { BackLink } from '@/components/back-link';
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
      <BackLink href="/categories" label="Back to Categories" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit Category — {category.nameDefault ?? '(untitled)'}</h1>
      <div className="mt-6">
        <CategoryEditForm category={category} categories={categories} />
      </div>
    </div>
  );
}

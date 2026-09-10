import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { MegaMenuItem, Category } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { MegaMenuItemForm } from '../../mega-menu-item-form';

export default async function EditMegaMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let item: MegaMenuItem;
  let categories: Category[];
  try {
    [item, categories] = await Promise.all([apiGet<MegaMenuItem>(`/admin/v1/navigation/mega-menu-items/${id}`), apiGet<Category[]>('/admin/v1/categories')]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <BackLink href="/content/navigation" label="Back to Mega Menu" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit Menu Item — {item.label}</h1>
      <div className="mt-6">
        <MegaMenuItemForm item={item} categories={categories} />
      </div>
    </div>
  );
}

import { apiGet } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { MegaMenuItemForm } from '../mega-menu-item-form';

export default async function NewMegaMenuItemPage() {
  const categories = await apiGet<Category[]>('/admin/v1/categories');

  return (
    <div>
      <BackLink href="/content/navigation" label="Back to Mega Menu" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">New Menu Item</h1>
      <div className="mt-6">
        <MegaMenuItemForm categories={categories} />
      </div>
    </div>
  );
}

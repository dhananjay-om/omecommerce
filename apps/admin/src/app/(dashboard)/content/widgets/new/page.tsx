import { apiGet } from '@/lib/api-client';
import type { CmsBlock, Category, Brand } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { WidgetForm } from '../widget-form';

export default async function NewWidgetPage() {
  const [blocks, categories, brands] = await Promise.all([
    apiGet<CmsBlock[]>('/admin/v1/cms/blocks'),
    apiGet<Category[]>('/admin/v1/categories'),
    apiGet<Brand[]>('/admin/v1/brands'),
  ]);

  return (
    <div>
      <BackLink href="/content/widgets" label="Back to Widgets" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">New Widget</h1>
      <div className="mt-6">
        <WidgetForm blocks={blocks} categories={categories} brands={brands} />
      </div>
    </div>
  );
}

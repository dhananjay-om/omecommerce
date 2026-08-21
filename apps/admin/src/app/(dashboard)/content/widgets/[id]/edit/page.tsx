import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { WidgetInstance, CmsBlock, Category, Brand } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { WidgetForm } from '../../widget-form';

export default async function EditWidgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let widget: WidgetInstance;
  try {
    widget = await apiGet<WidgetInstance>(`/admin/v1/widgets/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [blocks, categories, brands] = await Promise.all([
    apiGet<CmsBlock[]>('/admin/v1/cms/blocks'),
    apiGet<Category[]>('/admin/v1/categories'),
    apiGet<Brand[]>('/admin/v1/brands'),
  ]);

  return (
    <div>
      <BackLink href="/content/widgets" label="Back to Widgets" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit Widget — {widget.title ?? widget.type}</h1>
      <div className="mt-6">
        <WidgetForm widget={widget} blocks={blocks} categories={categories} brands={brands} />
      </div>
    </div>
  );
}

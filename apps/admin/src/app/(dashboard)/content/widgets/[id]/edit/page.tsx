import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { WidgetInstance, CmsBlock } from '@/lib/types';
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
  const blocks = await apiGet<CmsBlock[]>('/admin/v1/cms/blocks');

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Widget — {widget.title ?? widget.type}</h1>
      <div className="mt-6">
        <WidgetForm widget={widget} blocks={blocks} />
      </div>
    </div>
  );
}

import { apiGet } from '@/lib/api-client';
import type { CmsBlock } from '@/lib/types';
import { WidgetForm } from '../widget-form';

export default async function NewWidgetPage() {
  const blocks = await apiGet<CmsBlock[]>('/admin/v1/cms/blocks');

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New Widget</h1>
      <div className="mt-6">
        <WidgetForm blocks={blocks} />
      </div>
    </div>
  );
}

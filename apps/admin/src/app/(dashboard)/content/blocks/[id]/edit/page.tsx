import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { CmsBlock } from '@/lib/types';
import { CmsBlockForm } from '../../block-form';

export default async function EditCmsBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let block: CmsBlock;
  try {
    block = await apiGet<CmsBlock>(`/admin/v1/cms/blocks/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Block — {block.code}</h1>
      <div className="mt-6">
        <CmsBlockForm block={block} />
      </div>
    </div>
  );
}

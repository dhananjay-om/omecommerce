import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { CmsBlock } from '@/lib/types';
import { BackLink } from '@/components/back-link';
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
      <BackLink href="/content/blocks" label="Back to Blocks" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit Block — {block.code}</h1>
      <div className="mt-6">
        <CmsBlockForm block={block} />
      </div>
    </div>
  );
}

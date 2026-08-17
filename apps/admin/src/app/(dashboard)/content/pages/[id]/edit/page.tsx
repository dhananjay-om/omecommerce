import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { CmsPage } from '@/lib/types';
import { CmsPageForm } from '../../page-form';

export default async function EditCmsPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let page: CmsPage;
  try {
    page = await apiGet<CmsPage>(`/admin/v1/cms/pages/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Edit Page — {page.title}</h1>
      <div className="mt-6">
        <CmsPageForm page={page} />
      </div>
    </div>
  );
}

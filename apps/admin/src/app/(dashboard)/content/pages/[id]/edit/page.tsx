import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { CmsPage } from '@/lib/types';
import { BackLink } from '@/components/back-link';
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
      <BackLink href="/content/pages" label="Back to Pages" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit Page — {page.title}</h1>
      <div className="mt-6">
        <CmsPageForm page={page} />
      </div>
    </div>
  );
}

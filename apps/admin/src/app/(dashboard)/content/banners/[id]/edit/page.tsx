import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { Banner } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { BannerForm } from '../../banner-form';

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let banner: Banner;
  try {
    banner = await apiGet<Banner>(`/admin/v1/banners/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <BackLink href="/content/banners" label="Back to Banners" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit Banner — {banner.title}</h1>
      <div className="mt-6">
        <BannerForm banner={banner} />
      </div>
    </div>
  );
}

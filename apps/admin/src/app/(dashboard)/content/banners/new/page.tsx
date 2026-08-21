import { BackLink } from '@/components/back-link';
import { BannerForm } from '../banner-form';

export default function NewBannerPage() {
  return (
    <div>
      <BackLink href="/content/banners" label="Back to Banners" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">New Banner</h1>
      <div className="mt-6">
        <BannerForm />
      </div>
    </div>
  );
}

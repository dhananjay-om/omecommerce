import { BannerForm } from '../banner-form';

export default function NewBannerPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New Banner</h1>
      <div className="mt-6">
        <BannerForm />
      </div>
    </div>
  );
}

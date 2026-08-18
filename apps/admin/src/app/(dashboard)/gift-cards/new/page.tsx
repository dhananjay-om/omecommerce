import { apiGet } from '@/lib/api-client';
import type { Website } from '@/lib/types';
import { GiftCardForm } from '../gift-card-form';

export default async function NewGiftCardPage() {
  const websites = await apiGet<Website[]>('/admin/v1/websites');

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Issue Gift Card</h1>
      <div className="mt-6">
        <GiftCardForm websites={websites} />
      </div>
    </div>
  );
}

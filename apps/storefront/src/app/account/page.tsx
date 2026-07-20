import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import type { Customer } from '@/types/customer';

/** Placeholder account landing for Phase 1 — the full dashboard (orders, addresses, wishlist) is Phase 6. */
export default async function AccountPage() {
  const token = await getSession();
  if (!token) redirect('/login');

  const customer = await apiGet<Customer>('/store/v1/me', { auth: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">My Account</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as {customer.firstName ? `${customer.firstName} ` : ''}
        {customer.email}
      </p>
    </div>
  );
}

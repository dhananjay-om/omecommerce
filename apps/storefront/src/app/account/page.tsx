import { apiGet } from '@/lib/api-client';
import type { Customer } from '@/types/customer';

export default async function AccountPage() {
  const customer = await apiGet<Customer>('/store/v1/me', { auth: true });

  return (
    <div>
      <h2 className="text-lg font-semibold">Account Overview</h2>
      <p className="mt-2 text-muted-foreground">
        Signed in as {customer.firstName ? `${customer.firstName} ` : ''}
        {customer.email}
      </p>
    </div>
  );
}

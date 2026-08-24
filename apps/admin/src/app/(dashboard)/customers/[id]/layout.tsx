import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { CustomerDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { NavTabs } from '@/components/nav-tabs';

/**
 * Shared chrome for every /customers/[id]/* tab (Overview/Wallet/Loyalty/
 * Referrals) — name/email + status badge, plus a horizontal `NavTabs` strip
 * (admin UI revamp, Phase 2 — replaces the old left-rail `CustomerViewNav`,
 * same migration as orders/[id]/layout.tsx). `apiGet`'s fetch is deduped by
 * Next.js against the identical call each child page also makes.
 *
 * A deleted (or never-existent) customer 404s here — same notFound()-on-404
 * pattern as content/pages/[id]/edit — so this shows Next's not-found page
 * instead of an uncaught ApiError crashing to a 500.
 */
export default async function CustomerDetailLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;

  let customer: CustomerDetail;
  try {
    customer = await apiGet<CustomerDetail>(`/admin/v1/customers/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');

  return (
    <div>
      <Link href="/customers" className="text-sm text-muted-foreground hover:underline">
        ← Back to Customers
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{name || customer.email}</h1>
        <Badge variant={customer.isActive ? 'success' : 'secondary'}>{customer.isActive ? 'Active' : 'Inactive'}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{customer.email}</p>

      <div className="mt-6">
        <NavTabs
          items={[
            { href: `/customers/${customer.publicId}`, label: 'Overview' },
            { href: `/customers/${customer.publicId}/wallet`, label: 'Wallet' },
            { href: `/customers/${customer.publicId}/loyalty`, label: 'Loyalty' },
            { href: `/customers/${customer.publicId}/referrals`, label: 'Referrals' },
          ]}
        />
        <div className="mt-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { getMyCompanyCredit } from '@/services/company.service';
import { formatPrice } from '@/lib/format-price';
import type { AgingBucketLabel } from '@/types/company';

export const metadata = { title: 'Company Credit' };

const TERMS_LABEL: Record<string, string> = {
  NET_15: 'Net 15',
  NET_30: 'Net 30',
  NET_45: 'Net 45',
  NET_60: 'Net 60',
};

const BUCKET_LABEL: Record<AgingBucketLabel, string> = {
  current: 'Current',
  '1-30': '1–30 days overdue',
  '31-60': '31–60 days overdue',
  '61-90': '61–90 days overdue',
  '90+': '90+ days overdue',
};

const BUCKET_COLOR: Record<AgingBucketLabel, string> = {
  current: 'text-muted-foreground',
  '1-30': 'text-warning',
  '31-60': 'text-warning',
  '61-90': 'text-destructive',
  '90+': 'text-destructive',
};

/** "Open invoices with due dates" (plan/15 Phase 7) — a signed-in shopper's view of their company's on-account orders. `account: null` covers every non-eligible state uniformly (no company, no membership, no credit terms configured) — same framing as /account/company's own null-company case. */
export default async function CompanyCreditPage() {
  const { account, openInvoices } = await getMyCompanyCredit();

  if (!account) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Company Credit</h2>
        <p className="mt-2 text-muted-foreground">
          Your company doesn&apos;t have credit terms set up.{' '}
          <Link href="/account/company" className="underline">
            View your company
          </Link>{' '}
          or contact your organization&apos;s administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Company Credit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay on account ({TERMS_LABEL[account.termsType] ?? account.termsType}) — open invoices
          billed to your company.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Credit limit
          </div>
          <div className="mt-1 text-2xl font-bold">
            {formatPrice(account.creditLimit, account.currency)}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Outstanding
          </div>
          <div className="mt-1 text-2xl font-bold">
            {formatPrice(account.outstanding, account.currency)}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Available
          </div>
          <div className="mt-1 text-2xl font-bold text-success">
            {formatPrice(account.available, account.currency)}
          </div>
        </div>
      </div>

      {account.status === 'FROZEN' ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-destructive">
          This credit account is currently frozen — new orders can&apos;t be placed on account until
          it&apos;s reinstated.
        </p>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Open invoices</h3>
        {openInvoices.length === 0 ? (
          <p className="text-muted-foreground">
            No open invoices — everything on account has been settled.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Placed</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {openInvoices.map((inv) => (
                  <tr key={inv.orderPublicId} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/account/orders/${inv.orderPublicId}`} className="underline">
                        {inv.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '—'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${BUCKET_COLOR[inv.bucket]}`}>
                      {BUCKET_LABEL[inv.bucket]}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(inv.amount, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

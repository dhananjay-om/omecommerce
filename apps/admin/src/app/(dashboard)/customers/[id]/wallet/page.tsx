import { apiGet } from '@/lib/api-client';
import type { WalletView, WalletTransaction, WalletBucket, WalletSource } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { BalanceSummaryCard } from '@/components/balance-summary-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditWalletDialog } from './credit-wallet-dialog';
import { AdjustWalletDialog } from './adjust-wallet-dialog';
import { WalletStatusDialog } from './wallet-status-dialog';

const BUCKET_LABELS: Record<WalletBucket, string> = {
  STORE_CREDIT: 'Store Credit',
  PREPAID_TOPUP: 'Prepaid Top-up',
  CASHBACK: 'Cashback',
  LOYALTY_CONVERSION: 'Loyalty Conversion',
};

const SOURCE_LABELS: Record<WalletSource, string> = {
  REFUND: 'Refund',
  RETURN: 'Return',
  GOODWILL: 'Goodwill',
  TOPUP: 'Top-up',
  CASHBACK: 'Cashback',
  LOYALTY: 'Loyalty',
  GIFTCARD_LOAD: 'Gift Card Load',
  PROMO: 'Promo',
  ADMIN_ADJUST: 'Admin Adjustment',
  REFERRAL: 'Referral',
};

export default async function CustomerWalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [wallet, transactions] = await Promise.all([
    apiGet<WalletView>(`/admin/v1/customers/${id}/wallet`),
    apiGet<WalletTransaction[]>(`/admin/v1/customers/${id}/wallet/transactions`),
  ]);

  return (
    <div className="space-y-6">
      <BalanceSummaryCard label="Store credit balance" value={wallet.balance} currency={wallet.currency} status={wallet.status} />

      <div className="flex flex-wrap items-center gap-2">
        <CreditWalletDialog customerPublicId={id} />
        <AdjustWalletDialog customerPublicId={id} />
        <WalletStatusDialog customerPublicId={id} status={wallet.status} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No wallet activity yet.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{BUCKET_LABELS[t.bucket]}</TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell className={t.amount.startsWith('-') ? 'text-destructive' : undefined}>{formatPrice(t.amount, t.currency)}</TableCell>
                  <TableCell>{formatPrice(t.balanceAfter, t.currency)}</TableCell>
                  <TableCell>{SOURCE_LABELS[t.source]}</TableCell>
                  <TableCell className="text-muted-foreground">{t.reason ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

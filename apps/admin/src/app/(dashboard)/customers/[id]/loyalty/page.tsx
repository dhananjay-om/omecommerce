import { apiGet } from '@/lib/api-client';
import type { LoyaltyAccount, LoyaltyTransaction, LoyaltyTxnType, LoyaltySource } from '@/lib/types';
import { BalanceSummaryCard } from '@/components/balance-summary-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdjustLoyaltyDialog } from './adjust-loyalty-dialog';

const TYPE_LABELS: Record<LoyaltyTxnType, string> = {
  EARN: 'Earn',
  REDEEM: 'Redeem',
  EXPIRE: 'Expire',
  ADJUST: 'Adjust',
  REVERSE: 'Reverse',
};

const SOURCE_LABELS: Record<LoyaltySource, string> = {
  ORDER: 'Order',
  ADMIN: 'Admin',
  CUSTOMER: 'Customer',
  EXPIRE: 'Expiry',
  REVERSAL: 'Reversal',
  REFERRAL: 'Referral',
};

export default async function CustomerLoyaltyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [account, transactions] = await Promise.all([
    apiGet<LoyaltyAccount>(`/admin/v1/customers/${id}/loyalty`),
    apiGet<LoyaltyTransaction[]>(`/admin/v1/customers/${id}/loyalty/transactions`),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BalanceSummaryCard label="Points balance" value={account.pointsBalance} status={account.status} />
        <BalanceSummaryCard
          label="Lifetime points"
          value={account.lifetimePoints}
          footnote={account.tier ? `Current tier: ${account.tier.name}` : 'No tier reached yet'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AdjustLoyaltyDialog customerPublicId={id} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No loyalty activity yet.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[t.type]}</Badge>
                  </TableCell>
                  <TableCell className={t.points.startsWith('-') ? 'text-destructive' : undefined}>{t.points}</TableCell>
                  <TableCell>{t.balanceAfter}</TableCell>
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

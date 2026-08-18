import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { GiftCard, GiftCardTransaction } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BalanceSummaryCard } from '@/components/balance-summary-card';
import { AdjustGiftCardDialog } from '../adjust-gift-card-dialog';
import { DisableGiftCardDialog } from '../disable-gift-card-dialog';

export default async function GiftCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, transactions] = await Promise.all([
    apiGet<GiftCard>(`/admin/v1/gift-cards/${id}`),
    apiGet<GiftCardTransaction[]>(`/admin/v1/gift-cards/${id}/transactions`),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/gift-cards" className="text-sm text-muted-foreground hover:underline">
          ← Back to Gift Cards
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Gift Card •••• {card.codeLast4}</h1>
      </div>

      <BalanceSummaryCard label="Balance" value={card.balance} currency={card.currency} status={card.status} />

      {card.status !== 'DISABLED' ? (
        <div className="flex flex-wrap items-center gap-2">
          <AdjustGiftCardDialog publicId={card.publicId} />
          <DisableGiftCardDialog publicId={card.publicId} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-medium">
              <Badge variant={statusBadgeVariant(card.status)}>{card.status}</Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Kind</div>
            <div className="font-medium">{card.kind}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Initial Amount</div>
            <div className="font-medium">{formatPrice(card.initialAmount, card.currency)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Currency</div>
            <div className="font-medium">{card.currency}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Expires</div>
            <div className="font-medium">{card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : 'Never'}</div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell className={t.amount.startsWith('-') ? 'text-destructive' : undefined}>{formatPrice(t.amount, t.currency)}</TableCell>
                  <TableCell>{formatPrice(t.balanceAfter, t.currency)}</TableCell>
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

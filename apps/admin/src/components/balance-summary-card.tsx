import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { formatPrice } from '@/lib/format-price';

/**
 * Shared "how much, and what state" summary tile — Wallet balance, Gift Card
 * balance, and Loyalty points balance (Phase 3) all render one of these.
 * `value`/`currency` render through formatPrice when currency is given
 * (money); omit currency for a raw count (e.g. loyalty points). Deliberately
 * NOT shared with the transaction ledger below it — wallet/gift-card/loyalty
 * transactions have different columns per instrument, so each screen keeps
 * its own plain <Table>, matching this app's per-feature-table convention.
 */
export function BalanceSummaryCard({
  label,
  value,
  currency,
  status,
  footnote,
}: {
  label: string;
  value: string;
  currency?: string;
  status?: string;
  footnote?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-2">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold tracking-tight">{currency ? formatPrice(value, currency) : value}</div>
          {footnote ? <p className="mt-1 text-xs text-muted-foreground">{footnote}</p> : null}
        </div>
        {status ? <Badge variant={statusBadgeVariant(status)}>{status}</Badge> : null}
      </CardContent>
    </Card>
  );
}

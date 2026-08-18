import { getMyLoyaltyAccount, getMyLoyaltyTransactions, getLoyaltyProgram } from '@/services/loyalty.service';
import { ApiError } from '@/lib/api-client';
import { LoyaltyRedeemField } from '@/components/account/loyalty-redeem-field';
import type { LoyaltyAccount, LoyaltyTransaction, LoyaltySource, LoyaltyTxnType, PublicLoyaltyProgram } from '@/types/loyalty';

export const metadata = { title: 'Rewards' };

const TYPE_LABELS: Record<LoyaltyTxnType, string> = {
  EARN: 'Earned',
  REDEEM: 'Redeemed',
  EXPIRE: 'Expired',
  ADJUST: 'Adjustment',
  REVERSE: 'Reversed',
};

const SOURCE_LABELS: Record<LoyaltySource, string> = {
  ORDER: 'Order',
  ADMIN: 'Adjustment',
  CUSTOMER: 'Redemption',
  EXPIRE: 'Expiry',
  REVERSAL: 'Refund reversal',
  REFERRAL: 'Referral',
};

/** No ACTIVE loyalty program is treated as "rewards aren't offered here" — a
 *  perfectly normal state (plan/15 Phase 4), not a broken page. */
async function loadAccount(): Promise<{ account: LoyaltyAccount; transactions: LoyaltyTransaction[] } | null> {
  try {
    const [account, transactions] = await Promise.all([getMyLoyaltyAccount(), getMyLoyaltyTransactions()]);
    return { account, transactions };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function loadProgram(): Promise<PublicLoyaltyProgram | null> {
  try {
    return await getLoyaltyProgram();
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function RewardsPage() {
  const [data, program] = await Promise.all([loadAccount(), loadProgram()]);

  if (!data) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Rewards</h2>
        <p className="mt-2 text-muted-foreground">This store doesn&apos;t have a rewards program right now.</p>
      </div>
    );
  }

  const { account, transactions } = data;
  const nextTier = program?.tiers
    .filter((t) => Number(t.thresholdPoints) > Number(account.lifetimePoints))
    .sort((a, b) => Number(a.thresholdPoints) - Number(b.thresholdPoints))[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Rewards{program ? ` — ${program.name}` : ''}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Points are earned automatically on paid orders{program ? ` (${program.pointsPerCurrencyUnit} point per currency unit)` : ''} and convert to
          store credit when redeemed.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Points balance</div>
          <div className="text-3xl font-bold">{account.pointsBalance}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {account.tier ? `Current tier: ${account.tier.name}` : 'No tier yet'}
            {nextTier ? ` · ${Number(nextTier.thresholdPoints) - Number(account.lifetimePoints)} points to ${nextTier.name}` : ''}
          </p>
        </div>
        {program ? (
          <div className="w-full sm:w-80">
            <LoyaltyRedeemField pointsBalance={account.pointsBalance} redeemMinPoints={program.redeemMinPoints} />
            <p className="mt-1 text-xs text-muted-foreground">1 point = {program.pointValue} store credit.</p>
          </div>
        ) : null}
      </div>

      {transactions.length === 0 ? (
        <p className="text-muted-foreground">No rewards activity yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 text-right font-medium">Points</th>
                <th className="px-4 py-2 text-right font-medium">Balance After</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{TYPE_LABELS[t.type]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{SOURCE_LABELS[t.source]}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.points.startsWith('-') ? 'text-destructive' : 'text-success'}`}>{t.points}</td>
                  <td className="px-4 py-3 text-right">{t.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

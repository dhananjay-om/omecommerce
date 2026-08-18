import { getMyWallet, getMyWalletTransactions } from '@/services/wallet.service';
import { formatPrice } from '@/lib/format-price';
import { GiftCardRedeemField } from '@/components/account/gift-card-redeem-field';
import type { WalletBucket, WalletSource, WalletTxnType } from '@/types/wallet';

export const metadata = { title: 'Wallet' };

const BUCKET_LABELS: Record<WalletBucket, string> = {
  STORE_CREDIT: 'Store Credit',
  PREPAID_TOPUP: 'Prepaid Top-up',
  CASHBACK: 'Cashback',
  LOYALTY_CONVERSION: 'Loyalty Redemption',
};

const SOURCE_LABELS: Record<WalletSource, string> = {
  REFUND: 'Refund',
  RETURN: 'Return',
  GOODWILL: 'Goodwill Credit',
  TOPUP: 'Top-up',
  CASHBACK: 'Cashback',
  LOYALTY: 'Loyalty Redemption',
  GIFTCARD_LOAD: 'Gift Card',
  PROMO: 'Promotion',
  ADMIN_ADJUST: 'Adjustment',
  REFERRAL: 'Referral Reward',
};

const TYPE_LABELS: Record<WalletTxnType, string> = {
  CREDIT: 'Credit',
  DEBIT: 'Debit',
  ADJUST: 'Adjustment',
  EXPIRE: 'Expired',
};

export default async function WalletPage() {
  const [wallet, transactions] = await Promise.all([getMyWallet(), getMyWalletTransactions()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Store credit from refunds, redeemed points, referral rewards, and gift cards.</p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Store credit balance</div>
          <div className="text-3xl font-bold">{formatPrice(wallet.balance, wallet.currency)}</div>
          {wallet.status === 'FROZEN' ? <p className="mt-1 text-sm text-destructive">This wallet is currently frozen.</p> : null}
        </div>
        <div className="w-full sm:w-72">
          <GiftCardRedeemField />
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="text-muted-foreground">No wallet activity yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Bucket</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium">Balance After</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{TYPE_LABELS[t.type]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{BUCKET_LABELS[t.bucket]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{SOURCE_LABELS[t.source]}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.amount.startsWith('-') ? 'text-destructive' : 'text-success'}`}>
                    {formatPrice(t.amount, t.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatPrice(t.balanceAfter, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

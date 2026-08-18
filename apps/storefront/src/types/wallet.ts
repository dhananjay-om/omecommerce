export type WalletStatus = 'ACTIVE' | 'FROZEN';
export type WalletBucket = 'STORE_CREDIT' | 'PREPAID_TOPUP' | 'CASHBACK' | 'LOYALTY_CONVERSION';
export type WalletTxnType = 'CREDIT' | 'DEBIT' | 'ADJUST' | 'EXPIRE';
export type WalletSource = 'REFUND' | 'RETURN' | 'GOODWILL' | 'TOPUP' | 'CASHBACK' | 'LOYALTY' | 'GIFTCARD_LOAD' | 'PROMO' | 'ADMIN_ADJUST' | 'REFERRAL';

export interface Wallet {
  publicId: string;
  balance: string;
  currency: string;
  status: WalletStatus;
}

export interface WalletTransaction {
  bucket: WalletBucket;
  type: WalletTxnType;
  amount: string;
  balanceAfter: string;
  currency: string;
  source: WalletSource;
  reason: string | null;
  createdAt: string;
}

export interface RedeemGiftCardResult {
  redeemedAmount: string;
  walletBalance: string;
}

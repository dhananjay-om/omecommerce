import type { WalletBucket, WalletSource, WalletStatus, WalletTxnType } from '@prisma/client';

export interface CreditWalletCommand {
  customerPublicId: string;
  amount: string;
  bucket: WalletBucket;
  source: WalletSource;
  reason?: string;
}

export interface AdjustWalletCommand {
  customerPublicId: string;
  /** Signed: positive credits, negative debits (guarded, can fail with 409 insufficient balance). */
  amount: string;
  bucket: WalletBucket;
  reason: string;
}

export interface WalletView {
  publicId: string;
  balance: string;
  currency: string;
  status: WalletStatus;
}

export interface WalletTransactionView {
  bucket: WalletBucket;
  type: WalletTxnType;
  amount: string;
  balanceAfter: string;
  currency: string;
  source: WalletSource;
  reason: string | null;
  createdAt: string;
}

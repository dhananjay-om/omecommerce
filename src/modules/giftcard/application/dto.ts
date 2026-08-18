import type { GiftCardKind, GiftCardStatus, GiftCardTxnType } from '@prisma/client';

export interface IssueGiftCardCommand {
  websiteCode: string;
  amount: string;
  kind?: GiftCardKind;
  recipientEmail?: string | null;
  recipientName?: string | null;
  message?: string | null;
  expiresAt?: string | null;
}

export interface IssuedGiftCardView {
  publicId: string;
  /** The raw redeemable code — returned ONCE, here, and never again. */
  code: string;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
}

export interface GiftCardView {
  publicId: string;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
  kind: GiftCardKind;
  expiresAt: string | null;
}

export interface GiftCardTransactionView {
  type: GiftCardTxnType;
  amount: string;
  balanceAfter: string;
  currency: string;
  reason: string | null;
  createdAt: string;
}

export interface AdjustGiftCardCommand {
  amount: string;
  reason: string;
}

export interface ListGiftCardsQuery {
  status?: GiftCardStatus;
  last4?: string;
  recipientEmail?: string;
  websiteCode?: string;
  page?: number;
  pageSize?: number;
}

export interface GiftCardListItemView {
  publicId: string;
  codeLast4: string;
  initialAmount: string;
  balance: string;
  currency: string;
  status: GiftCardStatus;
  kind: GiftCardKind;
  recipientEmail: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GiftCardListView {
  total: number;
  page: number;
  pageSize: number;
  giftCards: GiftCardListItemView[];
}

export interface RedeemGiftCardIntoWalletResult {
  redeemedAmount: string;
  walletBalance: string;
}

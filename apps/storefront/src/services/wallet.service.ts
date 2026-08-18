import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { Wallet, WalletTransaction } from '@/types/wallet';

/** Server Component reads only — ownership-checked via the session cookie, same shape as order.service.ts's getCustomerOrder. */
export function getMyWallet(): Promise<Wallet> {
  return apiGet<Wallet>('/store/v1/me/wallet', { auth: true });
}

export function getMyWalletTransactions(): Promise<WalletTransaction[]> {
  return apiGet<WalletTransaction[]>('/store/v1/me/wallet/transactions', { auth: true });
}

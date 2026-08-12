import type { WalletLedger, CustomerContextLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { WalletView, WalletTransactionView } from './dto.js';

export class GetWalletBalance {
  constructor(
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(customerPublicId: string): Promise<WalletView> {
    const ctx = await this.customers.resolveByPublicId(customerPublicId);
    if (!ctx) throw new NotFoundError('customer', customerPublicId);
    // getOrCreate rather than a bare find: a customer with no wallet yet has an
    // implicit zero balance, not a 404 — matches "balance + buckets" always
    // being a meaningful answer for a registered customer (plan/10 §7).
    const wallet = await this.wallets.getOrCreateWallet(ctx.customerId, ctx.websiteId, ctx.currency);
    const snapshot = await this.wallets.findByPublicId(wallet.publicId);
    return { publicId: snapshot!.publicId, balance: snapshot!.balance, currency: snapshot!.currency, status: snapshot!.status };
  }
}

export class ListWalletTransactions {
  constructor(
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(customerPublicId: string): Promise<WalletTransactionView[]> {
    const ctx = await this.customers.resolveByPublicId(customerPublicId);
    if (!ctx) throw new NotFoundError('customer', customerPublicId);
    const wallet = await this.wallets.getOrCreateWallet(ctx.customerId, ctx.websiteId, ctx.currency);
    const rows = await this.wallets.listTransactions(wallet.id);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
}

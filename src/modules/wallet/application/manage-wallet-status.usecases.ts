import type { WalletLedger, CustomerContextLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export class FreezeWallet {
  constructor(
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(customerPublicId: string): Promise<void> {
    const ctx = await this.customers.resolveByPublicId(customerPublicId);
    if (!ctx) throw new NotFoundError('customer', customerPublicId);
    const wallet = await this.wallets.getOrCreateWallet(ctx.customerId, ctx.websiteId, ctx.currency);
    await this.wallets.freeze(wallet.id);
  }
}

export class UnfreezeWallet {
  constructor(
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(customerPublicId: string): Promise<void> {
    const ctx = await this.customers.resolveByPublicId(customerPublicId);
    if (!ctx) throw new NotFoundError('customer', customerPublicId);
    const wallet = await this.wallets.getOrCreateWallet(ctx.customerId, ctx.websiteId, ctx.currency);
    await this.wallets.unfreeze(wallet.id);
  }
}

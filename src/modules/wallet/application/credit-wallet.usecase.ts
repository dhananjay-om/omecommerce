import type { WalletLedger, CustomerContextLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CreditWalletCommand, WalletView } from './dto.js';

export class CreditWallet {
  constructor(
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(cmd: CreditWalletCommand, actorId?: bigint): Promise<WalletView> {
    const ctx = await this.customers.resolveByPublicId(cmd.customerPublicId);
    if (!ctx) {
      throw new NotFoundError('customer', cmd.customerPublicId);
    }
    const wallet = await this.wallets.getOrCreateWallet(ctx.customerId, ctx.websiteId, ctx.currency);
    const snapshot = await this.wallets.credit(wallet.id, cmd.amount, cmd.bucket, cmd.source, { actorId, reason: cmd.reason });
    return { publicId: snapshot.publicId, balance: snapshot.balance, currency: snapshot.currency, status: snapshot.status };
  }
}

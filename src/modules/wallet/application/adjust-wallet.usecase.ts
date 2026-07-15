import type { WalletLedger, CustomerContextLookup } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toMinorUnits, isNegative, fromMinorUnits } from '../../../shared/domain/decimal.js';
import type { AdjustWalletCommand, WalletView } from './dto.js';

/** Admin correction — positive credits, negative debits (guarded, can 409 on insufficient balance). Always source=ADMIN_ADJUST. */
export class AdjustWallet {
  constructor(
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(cmd: AdjustWalletCommand, actorId?: bigint): Promise<WalletView> {
    const ctx = await this.customers.resolveByPublicId(cmd.customerPublicId);
    if (!ctx) {
      throw new NotFoundError('customer', cmd.customerPublicId);
    }
    const minor = toMinorUnits(cmd.amount);
    if (minor === 0n) {
      throw new ValidationError('adjustment amount must be non-zero', [{ path: 'amount', message: 'non-zero' }]);
    }
    const wallet = await this.wallets.getOrCreateWallet(ctx.customerId, ctx.websiteId, ctx.currency);
    const magnitude = fromMinorUnits(isNegative(minor) ? -minor : minor);
    const snapshot = isNegative(minor)
      ? await this.wallets.debit(wallet.id, magnitude, cmd.bucket, 'ADMIN_ADJUST', { actorId, reason: cmd.reason, txnType: 'ADJUST' })
      : await this.wallets.credit(wallet.id, magnitude, cmd.bucket, 'ADMIN_ADJUST', { actorId, reason: cmd.reason, txnType: 'ADJUST' });
    return { publicId: snapshot.publicId, balance: snapshot.balance, currency: snapshot.currency, status: snapshot.status };
  }
}

import type { LoyaltyLedger, LoyaltyProgramRepository, LoyaltyTierRepository, CustomerContextLookup } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { isNegative } from '../../../shared/domain/decimal.js';
import type { LoyaltyAccountView, LoyaltyTransactionView, AdjustLoyaltyAccountCommand } from './dto.js';

async function resolveAccount(
  customerPublicId: string,
  customers: CustomerContextLookup,
  programs: LoyaltyProgramRepository,
  ledger: LoyaltyLedger,
): Promise<{ accountId: bigint; accountPublicId: string }> {
  const ctx = await customers.resolveByPublicId(customerPublicId);
  if (!ctx) throw new NotFoundError('customer', customerPublicId);
  const program = await programs.findByWebsiteId(ctx.websiteId);
  if (!program) throw new NotFoundError('loyalty program', 'no program configured for this website');
  const account = await ledger.getOrCreateAccount(ctx.customerId, program.id);
  return { accountId: account.id, accountPublicId: account.publicId };
}

export class GetLoyaltyAccount {
  constructor(
    private readonly ledger: LoyaltyLedger,
    private readonly programs: LoyaltyProgramRepository,
    private readonly tiers: LoyaltyTierRepository,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(customerPublicId: string): Promise<LoyaltyAccountView> {
    const { accountPublicId } = await resolveAccount(customerPublicId, this.customers, this.programs, this.ledger);
    const account = await this.ledger.findByPublicId(accountPublicId);
    if (!account) throw new NotFoundError('loyalty account', accountPublicId);

    let tierView = null;
    if (account.tierId) {
      const tierList = await this.tiers.listByProgramId(account.programId);
      const tier = tierList.find((t) => t.id === account.tierId);
      if (tier) tierView = { id: tier.id.toString(), name: tier.name, thresholdPoints: tier.thresholdPoints.toString(), earnMultiplier: tier.earnMultiplier };
    }

    return {
      publicId: account.publicId,
      pointsBalance: account.pointsBalance.toString(),
      lifetimePoints: account.lifetimePoints.toString(),
      tier: tierView,
      status: account.status,
    };
  }
}

export class ListLoyaltyTransactions {
  constructor(
    private readonly ledger: LoyaltyLedger,
    private readonly programs: LoyaltyProgramRepository,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(customerPublicId: string): Promise<LoyaltyTransactionView[]> {
    const { accountId } = await resolveAccount(customerPublicId, this.customers, this.programs, this.ledger);
    const rows = await this.ledger.listTransactions(accountId);
    return rows.map((r) => ({ ...r, points: r.points.toString(), balanceAfter: r.balanceAfter.toString(), createdAt: r.createdAt.toISOString() }));
  }
}

/** Admin manual grant/correction — signed: positive earns, negative redeems (guarded, can 409 on insufficient balance). */
export class AdjustLoyaltyAccount {
  constructor(
    private readonly ledger: LoyaltyLedger,
    private readonly programs: LoyaltyProgramRepository,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(cmd: AdjustLoyaltyAccountCommand, actorId?: bigint): Promise<LoyaltyAccountView> {
    const { accountId, accountPublicId } = await resolveAccount(cmd.customerPublicId, this.customers, this.programs, this.ledger);
    if (!/^-?\d+$/.test(cmd.points)) {
      throw new ValidationError('invalid points', [{ path: 'points', message: 'expected an integer' }]);
    }
    const points = BigInt(cmd.points);
    if (points === 0n) {
      throw new ValidationError('adjustment points must be non-zero', [{ path: 'points', message: 'non-zero' }]);
    }
    const magnitude = isNegative(points) ? -points : points;
    const updated = isNegative(points)
      ? await this.ledger.redeem(accountId, magnitude, 'ADMIN', { actorId, reason: cmd.reason, txnType: 'ADJUST' })
      : await this.ledger.earn(accountId, magnitude, 'ADMIN', { actorId, reason: cmd.reason, txnType: 'ADJUST' });
    return {
      publicId: accountPublicId,
      pointsBalance: updated.pointsBalance.toString(),
      lifetimePoints: updated.lifetimePoints.toString(),
      tier: null,
      status: updated.status,
    };
  }
}

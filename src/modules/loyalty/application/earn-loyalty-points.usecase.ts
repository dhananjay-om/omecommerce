import type { OrderLookup, LoyaltyProgramRepository, LoyaltyTierRepository, LoyaltyLedger } from '../domain/repositories.js';
import { SCALE, toMinorUnits, fromMinorUnits, applyRate } from '../../../shared/domain/decimal.js';

const SCALE_FACTOR = 10n ** BigInt(SCALE);

/** Whole points, floored — grandTotal * pointsPerCurrencyUnit * tierMultiplier, all scale-4 rates composed via applyRate. */
function computePoints(grandTotal: string, pointsPerCurrencyUnit: string, tierMultiplier: string): bigint {
  const grandTotalMinor = toMinorUnits(grandTotal);
  const rateMinor = toMinorUnits(pointsPerCurrencyUnit);
  const multiplierMinor = toMinorUnits(tierMultiplier);
  const combinedRateMinor = applyRate(rateMinor, multiplierMinor);
  const pointsScale4 = applyRate(grandTotalMinor, combinedRateMinor);
  return pointsScale4 / SCALE_FACTOR;
}

/**
 * Called by the loyalty-earn worker on `OrderPaid` (plan/11 §2.2). Idempotent
 * on `idempotencyKey: earn-<orderId>` — a re-delivered job (BullMQ
 * at-least-once) is a no-op, not a double-credit (see PrismaLoyaltyLedger.earn()).
 * Silently no-ops for guest orders (no customerId) or websites with no active
 * program — neither is an error condition.
 */
export class EarnLoyaltyPoints {
  constructor(
    private readonly orders: OrderLookup,
    private readonly programs: LoyaltyProgramRepository,
    private readonly tiers: LoyaltyTierRepository,
    private readonly ledger: LoyaltyLedger,
  ) {}

  async execute(orderPublicId: string): Promise<void> {
    const order = await this.orders.byPublicId(orderPublicId);
    if (!order || !order.customerId) return;

    const program = await this.programs.findByWebsiteId(order.websiteId);
    if (!program || program.status !== 'ACTIVE') return;

    const account = await this.ledger.getOrCreateAccount(order.customerId, program.id);
    const tierList = await this.tiers.listByProgramId(program.id);
    const before = await this.ledger.findByPublicId(account.publicId);
    const currentTier = tierList.find((t) => t.id === before?.tierId) ?? null;

    const points = computePoints(order.grandTotal, program.pointsPerCurrencyUnit, currentTier?.earnMultiplier ?? '1');
    if (points <= 0n) return;

    const updated = await this.ledger.earn(account.id, points, 'ORDER', {
      refType: 'Order',
      refId: order.id,
      idempotencyKey: `earn-${order.id}`,
      reason: `Earned from order ${orderPublicId} (${fromMinorUnits(toMinorUnits(order.grandTotal))})`,
    });

    const newTier =
      tierList
        .slice()
        .sort((a, b) => (a.thresholdPoints > b.thresholdPoints ? -1 : a.thresholdPoints < b.thresholdPoints ? 1 : 0))
        .find((t) => t.thresholdPoints <= updated.lifetimePoints) ?? null;
    if ((newTier?.id ?? null) !== updated.tierId) {
      await this.ledger.updateTier(account.id, newTier?.id ?? null);
    }
  }
}

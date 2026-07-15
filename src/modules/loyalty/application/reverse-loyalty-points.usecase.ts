import type { OrderLookup, LoyaltyProgramRepository, LoyaltyLedger } from '../domain/repositories.js';
import { toMinorUnits } from '../../../shared/domain/decimal.js';

/**
 * Called by the loyalty-earn worker on `OrderRefunded` (plan/11 §2.2
 * clawback). Reverses points proportionally to the refunded amount vs. the
 * order's original grand total: `pointsToReverse = floor(originalEarnedPoints
 * * refundAmount / grandTotal)`. If the account has already spent more than
 * that many points, `reverseUpTo` floors the reversal at the current balance
 * instead of throwing — a real "points debt" ledger is documented future work
 * (plan.md).
 *
 * `idempotencyKey` is the caller's responsibility (the worker passes the
 * BullMQ job's own id, `outbox-<row.id>`) rather than being derived from
 * `orderPublicId` alone — an order can have multiple partial refunds, each
 * its own outbox row/job, each needing its own reversal, so an order-scoped
 * key would wrongly dedupe a second real refund against the first.
 */
export class ReverseLoyaltyPoints {
  constructor(
    private readonly orders: OrderLookup,
    private readonly programs: LoyaltyProgramRepository,
    private readonly ledger: LoyaltyLedger,
  ) {}

  async execute(orderPublicId: string, refundAmount: string, idempotencyKey: string): Promise<void> {
    const order = await this.orders.byPublicId(orderPublicId);
    if (!order || !order.customerId) return;

    const program = await this.programs.findByWebsiteId(order.websiteId);
    if (!program) return;

    const account = await this.ledger.findByCustomerAndProgram(order.customerId, program.id);
    if (!account) return;

    const earnTxn = await this.ledger.findTransactionByRef(account.id, 'Order', order.id, 'EARN');
    if (!earnTxn) return;

    const grandTotalMinor = toMinorUnits(order.grandTotal);
    if (grandTotalMinor === 0n) return;
    const refundMinor = toMinorUnits(refundAmount);
    const pointsToReverse = (earnTxn.points * refundMinor) / grandTotalMinor;
    if (pointsToReverse <= 0n) return;

    await this.ledger.reverseUpTo(account.id, pointsToReverse, 'REVERSAL', {
      refType: 'Order',
      refId: order.id,
      idempotencyKey,
      reason: `Refund of ${refundAmount} on order ${orderPublicId}`,
    });
  }
}

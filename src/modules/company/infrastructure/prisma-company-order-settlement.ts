import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { CompanyOrderSettlement } from '../domain/repositories.js';

/**
 * Cross-module write port into the Order module (plan/15 Phase 7 — own copy,
 * per this project's per-module lookup convention; company module reads/
 * writes `order`/`order_status_history` directly here the same way
 * PrismaCompanyMembershipLookup, in the ORDER module's own infra, reads
 * `company`/`company_customer` directly — Prisma models aren't fenced by
 * module boundaries, only the convention of never importing another
 * module's repository CLASS is).
 */
export class PrismaCompanyOrderSettlement implements CompanyOrderSettlement {
  private readonly outbox: OutboxWriter;

  constructor(private readonly db: Db) {
    this.outbox = new OutboxWriter(db);
  }

  async findSettleableByPublicId(
    companyId: bigint,
    orderPublicId: string,
  ): Promise<{ id: bigint; publicId: string; orderNumber: string; grandTotal: string } | null> {
    const order = await this.db.order.findFirst({
      where: { publicId: orderPublicId, companyId, financialStatus: 'ON_ACCOUNT' },
      select: { id: true, publicId: true, orderNumber: true, grandTotal: true },
    });
    return order
      ? { id: order.id, publicId: order.publicId, orderNumber: order.orderNumber.toString(), grandTotal: fromMinorUnits(toMinorUnits(order.grandTotal.toString())) }
      : null;
  }

  async markSettled(orderId: bigint): Promise<void> {
    const order = await this.db.order.update({
      where: { id: orderId },
      data: { financialStatus: 'PAID' },
      select: { publicId: true, orderNumber: true, grandTotal: true },
    });
    // Same eventType/actorType shape CompleteCheckout's own success path
    // writes for a normal order — this is that same "payment received" fact,
    // just arriving via settlement instead of at checkout.
    await this.db.orderStatusHistory.create({
      data: {
        orderId,
        eventType: 'PAYMENT_RECEIVED',
        fromValue: 'ON_ACCOUNT',
        toValue: 'PAID',
        message: 'Settled via a recorded credit-terms payment',
        actorType: 'ADMIN',
      },
    });
    // Fires only now — not at checkout — so loyalty earning and referral
    // qualification wait for money actually collected (plan/15 Phase 7's
    // entire reason for existing).
    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'OrderPaid',
      payload: { orderNumber: order.orderNumber.toString(), grandTotal: fromMinorUnits(toMinorUnits(order.grandTotal.toString())) },
    });
  }
}

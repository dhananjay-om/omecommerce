import type { OrderRepository, AdminUserLookup } from '../domain/repositories.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import { toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';

/**
 * Settles a COD (or any other manually-collected) order — the counterpart to
 * PrismaCompanyOrderSettlement.markSettled for B2B credit terms, same "flip
 * to PAID and only then fire OrderPaid" reasoning, just for a single order
 * instead of a company's whole receivable. Only ever legal from PENDING:
 * every other financialStatus already means either the money moved through
 * a different path (PAID/ON_ACCOUNT) or the order was explicitly rejected
 * (FAILED/VOIDED) — neither should be silently overwritten by this.
 */
export class MarkOrderPaidManually {
  constructor(
    private readonly orders: OrderRepository,
    private readonly adminUsers: AdminUserLookup,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(orderPublicId: string, cmd: { amount: string; note?: string }, actorPublicId?: string): Promise<void> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('order', orderPublicId);
    if (order.financialStatus !== 'PENDING') {
      throw new ConflictError(`order is ${order.financialStatus}, not PENDING — nothing to mark paid`);
    }
    const actor = actorPublicId ? await this.adminUsers.findByPublicId(actorPublicId) : null;

    const amountMinor = toMinorUnits(cmd.amount);

    await this.orders.recordPayment({
      orderId: order.id,
      method: order.paymentMethodCode ?? 'cod',
      gateway: 'manual',
      type: 'CAPTURE',
      amountMinor,
      currency: order.currency,
      status: 'SUCCEEDED',
      gatewayRef: null,
    });
    await this.orders.setFinancialStatus(order.id, 'PAID');
    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'PAYMENT_RECEIVED',
      fromValue: 'PENDING',
      toValue: 'PAID',
      message: cmd.note?.trim() || `Marked paid manually — ${fromMinorUnits(amountMinor)} ${order.currency} collected`,
      actorType: actor ? 'ADMIN' : 'SYSTEM',
      actorId: actor?.id ?? null,
      actorName: actor?.email ?? null,
    });
    // Fires only now — not at checkout — so loyalty earning and referral
    // qualification wait for cash actually collected, same reasoning
    // CompanyOrderSettlement.markSettled already documents for ON_ACCOUNT.
    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'OrderPaid',
      payload: { orderNumber: order.orderNumber, grandTotal: order.grandTotal },
    });
  }
}

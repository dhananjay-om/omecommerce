import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import type { RefundOrder } from './refund-order.usecase.js';
import type { OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

/** The money-moving step of a return's lifecycle — deliberately reuses
 *  the existing, already-proven RefundOrder usecase rather than a second
 *  refund engine (per this feature area's own confirmed design). A
 *  return's `restock` flag is per LINE, but RefundOrderCommand's is one
 *  flag for the whole call — so a return with mixed restock flags across
 *  its lines calls RefundOrder up to twice (once per restock value),
 *  never fabricating a single flag that would silently mis-restock some
 *  lines. */
export class RefundReturn {
  constructor(
    private readonly orders: OrderRepository,
    private readonly refundOrder: RefundOrder,
  ) {}

  async execute(returnPublicId: string): Promise<OrderViewDto> {
    const ret = await this.orders.findReturnByPublicId(returnPublicId);
    if (!ret) throw new NotFoundError('OrderReturn', returnPublicId);
    if (ret.status !== 'APPROVED' && ret.status !== 'RECEIVED') {
      throw new InvalidOrderStateError(`return ${returnPublicId} is ${ret.status.toLowerCase()} — must be approved or received before refunding`);
    }

    const restockLines = ret.lines.filter((l) => l.restock).map((l) => ({ sku: l.sku, qty: l.qty }));
    const keepLines = ret.lines.filter((l) => !l.restock).map((l) => ({ sku: l.sku, qty: l.qty }));
    // The customer's own choice, captured at request time (or an admin's,
    // if set when logging the return) — null on an older return with no
    // preference recorded, in which case RefundOrder's own default
    // (ORIGINAL_PAYMENT_METHOD) applies, exactly as before this existed.
    const refundTo = (ret.refundTo as 'ORIGINAL_PAYMENT_METHOD' | 'WALLET' | null) ?? undefined;

    if (restockLines.length > 0) {
      await this.refundOrder.execute({ orderPublicId: ret.orderPublicId, lines: restockLines, restock: true, refundTo });
    }
    if (keepLines.length > 0) {
      await this.refundOrder.execute({ orderPublicId: ret.orderPublicId, lines: keepLines, restock: false, refundTo });
    }

    await this.orders.setReturnStatus(ret.id, 'REFUNDED');
    await this.orders.recordHistory({
      orderId: ret.orderId,
      eventType: 'RETURN_REFUNDED',
      message: `Return refunded (${ret.lines.length} line(s))`,
      actorType: 'ADMIN',
    });

    const order = await this.orders.findByPublicId(ret.orderPublicId);
    return toOrderDto(order!);
  }
}

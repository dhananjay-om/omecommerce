import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import type { UpdateReturnStatusCommand } from './dto.js';

/** The non-monetary part of a return's lifecycle — REQUESTED ->
 *  APPROVED -> RECEIVED, or REJECTED from either of those two. REFUNDED
 *  is deliberately NOT reachable here — it's only ever set by
 *  RefundReturn, which actually moves money (reuses the existing
 *  RefundOrder usecase), so a plain status PATCH can never claim money
 *  was refunded when it wasn't. */
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  REQUESTED: new Set(['APPROVED', 'REJECTED']),
  APPROVED: new Set(['RECEIVED', 'REJECTED']),
  RECEIVED: new Set(['REJECTED']),
};

export class UpdateReturnStatus {
  constructor(private readonly orders: OrderRepository) {}

  async execute(cmd: UpdateReturnStatusCommand): Promise<void> {
    const ret = await this.orders.findReturnByPublicId(cmd.returnPublicId);
    if (!ret) throw new NotFoundError('OrderReturn', cmd.returnPublicId);

    const allowed = ALLOWED_TRANSITIONS[ret.status];
    if (!allowed?.has(cmd.status)) {
      throw new InvalidOrderStateError(`return ${cmd.returnPublicId} is ${ret.status.toLowerCase()} — cannot move to ${cmd.status.toLowerCase()}`);
    }

    await this.orders.setReturnStatus(ret.id, cmd.status);
    await this.orders.recordHistory({
      orderId: ret.orderId,
      eventType: `RETURN_${cmd.status}`,
      fromValue: ret.status,
      toValue: cmd.status,
      actorType: 'ADMIN',
    });
  }
}

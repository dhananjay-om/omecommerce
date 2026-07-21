import type { OrderRepository, AdminUserLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { AddOrderNoteCommand, OrderNoteDto } from './dto.js';

/** plan/15 Phase 0b. */
export class AddOrderNote {
  constructor(
    private readonly orders: OrderRepository,
    private readonly adminUsers: AdminUserLookup,
  ) {}

  async execute(cmd: AddOrderNoteCommand): Promise<OrderNoteDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);

    const actor = cmd.createdBy ? await this.adminUsers.findByPublicId(cmd.createdBy) : null;

    const note = await this.orders.addNote({ orderId: order.id, type: cmd.type, body: cmd.body, createdBy: actor?.id ?? null });

    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'NOTE_ADDED',
      message: cmd.type === 'INTERNAL' ? 'Internal note added' : 'Customer note added',
      actorType: actor ? 'ADMIN' : 'SYSTEM',
      actorId: actor?.id ?? null,
      actorName: actor?.email ?? null,
    });

    return { id: note.id.toString(), type: note.type, body: note.body, createdAt: note.createdAt.toISOString() };
  }
}

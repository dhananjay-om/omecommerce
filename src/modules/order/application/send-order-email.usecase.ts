import type { OrderRepository, AdminUserLookup } from '../domain/repositories.js';
import type { EmailSender } from '../domain/ports.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { buildOrderEmailContent } from '../infrastructure/order-email-templates.js';
import type { SendOrderEmailCommand, OrderEmailLogDto } from './dto.js';

/** plan/15 Phase 3 — manual "Send Email" action. Never throws on a send failure (that's a business outcome, logged as FAILED), only on bad input/missing order. */
export class SendOrderEmail {
  constructor(
    private readonly orders: OrderRepository,
    private readonly adminUsers: AdminUserLookup,
    private readonly emailSender: EmailSender,
  ) {}

  async execute(cmd: SendOrderEmailCommand): Promise<OrderEmailLogDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);

    let subject: string;
    let html: string;
    if (cmd.type === 'CUSTOM') {
      const errors: Array<{ path: string; message: string }> = [];
      if (!cmd.subject) errors.push({ path: 'subject', message: 'required for type=CUSTOM' });
      if (!cmd.body) errors.push({ path: 'body', message: 'required for type=CUSTOM' });
      if (errors.length > 0) throw new ValidationError('CUSTOM emails require subject and body', errors);
      subject = cmd.subject!;
      html = cmd.body!;
    } else {
      const content = buildOrderEmailContent(cmd.type, order);
      subject = content.subject;
      html = content.html;
    }

    const actor = cmd.sentBy ? await this.adminUsers.findByPublicId(cmd.sentBy) : null;

    let status: 'SENT' | 'FAILED';
    let providerRef: string | null = null;
    try {
      const result = await this.emailSender.send({ to: order.email, subject, html });
      providerRef = result.providerRef;
      status = 'SENT';
    } catch {
      status = 'FAILED';
    }

    const logEntry = await this.orders.recordEmailLog({
      orderId: order.id,
      emailType: cmd.type,
      toEmail: order.email,
      subject,
      status,
      providerRef,
      sentBy: actor?.id ?? null,
    });

    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'EMAIL_SENT',
      message: status === 'SENT' ? `Email "${subject}" sent to ${order.email}` : `Email "${subject}" failed to send to ${order.email}`,
      actorType: actor ? 'ADMIN' : 'SYSTEM',
      actorId: actor?.id ?? null,
      actorName: actor?.email ?? null,
    });

    return {
      id: logEntry.id.toString(),
      emailType: logEntry.emailType,
      toEmail: logEntry.toEmail,
      subject: logEntry.subject,
      status: logEntry.status,
      createdAt: logEntry.createdAt.toISOString(),
    };
  }
}

import type { OrderRepository, AdminUserLookup, WebsiteTaxConfigLookup, VariantLookup, CartProductMediaLookup, OrderView } from '../domain/repositories.js';
import type { EmailSender, MediaUrlResolver } from '../domain/ports.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { buildOrderEmailContent } from '../infrastructure/order-email-templates.js';
import { resolveInvoiceBranding } from '../infrastructure/invoice-branding.js';
import type { SendOrderEmailCommand, OrderEmailLogDto } from './dto.js';

/** plan/15 Phase 3 — manual "Send Email" action; also the shared engine behind
 *  every automatic order-lifecycle email (order-notification.worker.ts calls
 *  this same execute() so both paths log to the same OrderEmailLog and use
 *  identical branding/templates). Never throws on a send failure (that's a
 *  business outcome, logged as FAILED), only on bad input/missing order. */
export class SendOrderEmail {
  constructor(
    private readonly orders: OrderRepository,
    private readonly adminUsers: AdminUserLookup,
    private readonly emailSender: EmailSender,
    private readonly websiteTaxConfig: WebsiteTaxConfigLookup,
    private readonly variants: VariantLookup,
    private readonly productMedia: CartProductMediaLookup,
    private readonly mediaUrls: MediaUrlResolver,
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
      const [websiteConfig, lineImageUrls] = await Promise.all([
        this.websiteTaxConfig.byId(order.websiteId),
        this.resolveLineImageUrls(order),
      ]);
      // Same "no website row found" fallback create-invoice.usecase.ts
      // already uses for the same underlying lookup — a print/letterhead
      // page never blocks over missing branding, and neither should an email.
      const invoiceBranding = await resolveInvoiceBranding(
        websiteConfig ?? { name: 'Store', gstin: null, address: null, logoMediaKey: null },
      );
      const content = buildOrderEmailContent(cmd.type, order, {
        companyName: invoiceBranding.sellerName,
        companyAddress: invoiceBranding.sellerAddress,
        supportEmail: websiteConfig?.supportEmail ?? null,
        logoDataUri: invoiceBranding.logoDataUri,
        lineImageUrls,
      });
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

  /** Every order line's product thumbnail, keyed by variantId.toString() — a
   *  line whose variant/product/image lookup comes back empty at any step is
   *  simply left out of the map (the template renders a plain placeholder),
   *  never fails the whole email over one missing thumbnail. */
  private async resolveLineImageUrls(order: OrderView): Promise<Map<string, string>> {
    const entries = await Promise.all(
      order.lines.map(async (line): Promise<[string, string] | null> => {
        const variant = await this.variants.byId(line.variantId);
        if (!variant) return null;
        const key = await this.productMedia.primaryImageKey(variant.productId);
        if (!key) return null;
        const url = await this.mediaUrls.presignGetUrl(key);
        return [line.variantId.toString(), url];
      }),
    );
    return new Map(entries.filter((e): e is [string, string] => e !== null));
  }
}

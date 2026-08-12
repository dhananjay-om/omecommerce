import type { OrderRepository } from '../domain/repositories.js';
import type { MediaUrlResolver } from '../domain/ports.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/** plan/15 Phase 1 — resolves a stored invoice PDF to a fresh, short-lived GET URL (same presign-not-proxy convention as product media, see MediaUrlResolver's doc comment). */
export class GetInvoicePdfUrl {
  constructor(
    private readonly orders: OrderRepository,
    private readonly mediaUrlResolver: MediaUrlResolver,
  ) {}

  async execute(orderPublicId: string, invoicePublicId: string): Promise<string> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    const invoice = order.invoices.find((inv) => inv.publicId === invoicePublicId);
    if (!invoice) throw new NotFoundError('Invoice', invoicePublicId);
    if (!invoice.pdfStorageKey) throw new NotFoundError('Invoice PDF', invoicePublicId);
    return this.mediaUrlResolver.presignGetUrl(invoice.pdfStorageKey);
  }
}

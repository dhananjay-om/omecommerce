import type { OrderRepository, WebsiteTaxConfigLookup } from '../domain/repositories.js';
import type { PdfRenderer, PdfStorage } from '../domain/ports.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { buildInvoiceHtml } from '../infrastructure/invoice-template.js';
import type { OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

/** plan/15 Phase 1 — re-renders the PDF from the invoice's existing (immutable) snapshot data and overwrites the stored file at the same key. Never changes invoiceNumber or line amounts — only useful after a template/branding fix, not a way to "re-invoice." */
export class RegenerateInvoice {
  constructor(
    private readonly orders: OrderRepository,
    private readonly pdfRenderer: PdfRenderer,
    private readonly pdfStorage: PdfStorage,
    private readonly websiteTaxConfig: WebsiteTaxConfigLookup,
  ) {}

  async execute(orderPublicId: string, invoicePublicId: string): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    const invoice = order.invoices.find((inv) => inv.publicId === invoicePublicId);
    if (!invoice) throw new NotFoundError('Invoice', invoicePublicId);

    const sellerConfig = await this.websiteTaxConfig.byId(order.websiteId);
    const html = buildInvoiceHtml(order, invoice, sellerConfig?.gstin ?? null);
    const pdf = await this.pdfRenderer.render(html);
    const key = invoice.pdfStorageKey ?? `invoices/${order.publicId}/${invoice.publicId}.pdf`;
    await this.pdfStorage.store(key, pdf);
    await this.orders.setInvoicePdfKey(invoice.id, key);

    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'INVOICE_REGENERATED',
      message: `Invoice ${invoice.invoiceNumber} PDF regenerated`,
      actorType: 'ADMIN',
    });

    const final = await this.orders.findByPublicId(orderPublicId);
    return toOrderDto(final!);
  }
}

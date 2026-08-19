import type { OrderRepository, AdminUserLookup, WebsiteTaxConfigLookup } from '../domain/repositories.js';
import type { PdfRenderer, PdfStorage } from '../domain/ports.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError, InvoiceExceedsQtyError } from '../domain/errors.js';
import { addMinor, subtractMinor, toMinorUnits } from '../../../shared/domain/decimal.js';
import { buildInvoiceHtml } from '../infrastructure/invoice-template.js';
import { resolveInvoiceBranding } from '../infrastructure/invoice-branding.js';
import type { CreateInvoiceCommand, OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

/** plan/15 Phase 1. An order must have been paid at least once before it can be invoiced — same guard FulfillOrder already uses. */
// ON_ACCOUNT (plan/15 Phase 7) is invoiceable too — a B2B buyer's invoice IS
// the bill they'll settle later, not something that waits for settlement.
const INVOICEABLE_FINANCIAL_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'ON_ACCOUNT']);

export class CreateInvoice {
  constructor(
    private readonly orders: OrderRepository,
    private readonly adminUsers: AdminUserLookup,
    private readonly pdfRenderer: PdfRenderer,
    private readonly pdfStorage: PdfStorage,
    private readonly websiteTaxConfig: WebsiteTaxConfigLookup,
  ) {}

  async execute(cmd: CreateInvoiceCommand): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);
    if (!INVOICEABLE_FINANCIAL_STATUSES.has(order.financialStatus)) {
      throw new InvalidOrderStateError(`order ${cmd.orderPublicId} has not been paid — cannot invoice`);
    }

    const alreadyInvoicedByLine = new Map<bigint, number>();
    for (const invoice of order.invoices) {
      for (const line of invoice.lines) {
        alreadyInvoicedByLine.set(line.orderLineId, (alreadyInvoicedByLine.get(line.orderLineId) ?? 0) + line.qty);
      }
    }

    const invoiceLines: Array<{ orderLineId: bigint; qty: number; unitPriceMinor: bigint; taxAmountMinor: bigint; discountAmountMinor: bigint; rowTotalMinor: bigint }> = [];
    const requested: Array<{ sku: string; qty: number | null }> = cmd.lines ?? order.lines.map((l) => ({ sku: l.sku, qty: null }));

    for (const req of requested) {
      const line = order.lines.find((l) => l.sku === req.sku);
      if (!line) throw new NotFoundError('OrderLine', req.sku);
      const alreadyInvoiced = alreadyInvoicedByLine.get(line.id) ?? 0;
      const remaining = line.qty - alreadyInvoiced;
      const qty = req.qty ?? remaining;
      if (qty <= 0) continue; // default-all-remaining pass over an already-fully-invoiced line: skip silently
      if (qty > remaining) throw new InvoiceExceedsQtyError(line.sku);

      const unitPriceMinor = toMinorUnits(line.unitPrice);
      const lineTaxMinor = toMinorUnits(line.taxAmount);
      const lineDiscountMinor = toMinorUnits(line.discountAmount);
      const taxAmountMinor = (lineTaxMinor * BigInt(qty)) / BigInt(line.qty);
      const discountAmountMinor = (lineDiscountMinor * BigInt(qty)) / BigInt(line.qty);
      const rowTotalMinor = unitPriceMinor * BigInt(qty) + taxAmountMinor;
      invoiceLines.push({ orderLineId: line.id, qty, unitPriceMinor, taxAmountMinor, discountAmountMinor, rowTotalMinor });
    }

    if (invoiceLines.length === 0) {
      throw new InvalidOrderStateError(`order ${cmd.orderPublicId} is already fully invoiced`);
    }

    const subtotalMinor = invoiceLines.reduce((acc, l) => addMinor(acc, l.unitPriceMinor * BigInt(l.qty)), 0n);
    const taxTotalMinor = invoiceLines.reduce((acc, l) => addMinor(acc, l.taxAmountMinor), 0n);
    // Each invoiced line's OWN share of the discount it actually received
    // (OrderLine.discountAmount, populated at order-creation time — see
    // coupon.prisma's header comment), prorated by invoiced-qty/line-qty — same
    // technique as tax's per-line split above. This is correct regardless of
    // whether the order's coupon was CART-target (every line got a share) or
    // ITEM-target (only matching lines did) — a single order-wide ratio (the
    // previous approach) would incorrectly spread an ITEM-target coupon's
    // discount onto lines it never actually applied to when only some of the
    // order's lines are invoiced.
    const discountTotalMinor = invoiceLines.reduce((acc, l) => addMinor(acc, l.discountAmountMinor), 0n);
    const grandTotalMinor = subtractMinor(addMinor(subtotalMinor, taxTotalMinor), discountTotalMinor);

    const actor = cmd.createdBy ? await this.adminUsers.findByPublicId(cmd.createdBy) : null;
    const invoiceNumber = await this.orders.nextInvoiceNumber(order.websiteId);

    const invoice = await this.orders.createInvoice({
      orderId: order.id,
      invoiceNumber,
      subtotalMinor,
      discountTotalMinor,
      taxTotalMinor,
      grandTotalMinor,
      createdBy: actor?.id ?? null,
      lines: invoiceLines,
    });

    const sellerConfig = await this.websiteTaxConfig.byId(order.websiteId);
    const branding = await resolveInvoiceBranding(sellerConfig ?? { name: 'Store', gstin: null, address: null, logoMediaKey: null });
    const html = await buildInvoiceHtml(order, invoice, branding);
    const pdf = await this.pdfRenderer.render(html);
    const key = `invoices/${order.publicId}/${invoice.publicId}.pdf`;
    await this.pdfStorage.store(key, pdf);
    await this.orders.setInvoicePdfKey(invoice.id, key);

    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'INVOICE_CREATED',
      message: `Invoice ${invoice.invoiceNumber} created`,
      actorType: actor ? 'ADMIN' : 'SYSTEM',
      actorId: actor?.id ?? null,
      actorName: actor?.email ?? null,
    });

    const final = await this.orders.findByPublicId(cmd.orderPublicId);
    return toOrderDto(final!);
  }
}

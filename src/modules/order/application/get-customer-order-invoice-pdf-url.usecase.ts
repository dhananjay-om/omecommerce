import type { OrderRepository, CustomerLookup } from '../domain/repositories.js';
import type { MediaUrlResolver } from '../domain/ports.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/** plan/15 Phase 11 — the customer downloads their order's most recent invoice (no invoiceId param; a customer has no reason to pick among partial invoices). Ownership-checked, same pattern as GetCustomerOrder. */
export class GetCustomerOrderInvoicePdfUrl {
  constructor(
    private readonly orders: OrderRepository,
    private readonly customers: CustomerLookup,
    private readonly mediaUrlResolver: MediaUrlResolver,
  ) {}

  async execute(customerPublicId: string, orderPublicId: string): Promise<string> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) throw new NotFoundError('customer', customerPublicId);

    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order || order.customerId !== customerId) throw new NotFoundError('Order', orderPublicId);

    const invoice = order.invoices[order.invoices.length - 1];
    if (!invoice?.pdfStorageKey) throw new NotFoundError('Invoice', orderPublicId);
    return this.mediaUrlResolver.presignGetUrl(invoice.pdfStorageKey);
  }
}

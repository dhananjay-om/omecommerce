import type { OrderRepository } from '../domain/repositories.js';
import type { MediaUrlResolver } from '../domain/ports.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/** plan/15 Phase 2 — resolves a stored packing-slip PDF to a fresh, short-lived GET URL (same presign-not-proxy convention as GetInvoicePdfUrl). */
export class GetPackingSlipPdfUrl {
  constructor(
    private readonly orders: OrderRepository,
    private readonly mediaUrlResolver: MediaUrlResolver,
  ) {}

  async execute(orderPublicId: string, fulfillmentPublicId: string): Promise<string> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);
    const fulfillment = order.fulfillments.find((f) => f.publicId === fulfillmentPublicId);
    if (!fulfillment) throw new NotFoundError('Fulfillment', fulfillmentPublicId);
    if (!fulfillment.packingSlipStorageKey) throw new NotFoundError('Packing slip', fulfillmentPublicId);
    return this.mediaUrlResolver.presignGetUrl(fulfillment.packingSlipStorageKey);
  }
}

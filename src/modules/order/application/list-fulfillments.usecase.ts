import type { OrderRepository } from '../domain/repositories.js';
import type { ListFulfillmentsQuery, FulfillmentListDto } from './dto.js';
import { endOfDayIfDateOnly } from './list-orders.usecase.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Cross-order Shipments list — see the Fulfillment plan's own doc
 *  comment: FulfillOrder already writes every field this reads, this is
 *  purely the missing aggregation, same thin-usecase shape as ListOrders. */
export class ListFulfillments {
  constructor(private readonly orders: OrderRepository) {}

  async execute(query: ListFulfillmentsQuery): Promise<FulfillmentListDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.orders.listFulfillments({
      page,
      pageSize,
      status: query.status,
      carrier: query.carrier,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? endOfDayIfDateOnly(query.dateTo) : undefined,
    });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      fulfillments: result.fulfillments.map((f) => ({
        publicId: f.publicId,
        orderPublicId: f.orderPublicId,
        orderNumber: f.orderNumber,
        email: f.email,
        status: f.status,
        carrier: f.carrier,
        trackingNumber: f.trackingNumber,
        carrierTrackingUrl: f.carrierTrackingUrl,
        estimatedDeliveryAt: f.estimatedDeliveryAt ? f.estimatedDeliveryAt.toISOString() : null,
        currentStatus: f.currentStatus,
        shippedAt: f.shippedAt ? f.shippedAt.toISOString() : null,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }
}

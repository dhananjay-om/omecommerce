import type { OrderRepository } from '../domain/repositories.js';
import type { ListOrdersQuery, OrderListDto } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListOrders {
  constructor(private readonly orders: OrderRepository) {}

  async execute(query: ListOrdersQuery): Promise<OrderListDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.orders.list({
      page,
      pageSize,
      status: query.status,
      financialStatus: query.financialStatus,
      email: query.email,
    });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      orders: result.orders.map((o) => ({
        publicId: o.publicId,
        orderNumber: o.orderNumber,
        email: o.email,
        currency: o.currency,
        status: o.status,
        financialStatus: o.financialStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        grandTotal: o.grandTotal,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }
}

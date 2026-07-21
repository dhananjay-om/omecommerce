import type { OrderRepository } from '../domain/repositories.js';
import type { ListOrdersQuery, OrderListDto } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function endOfDayIfDateOnly(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
}

export class ListOrders {
  constructor(private readonly orders: OrderRepository) {}

  async execute(query: ListOrdersQuery): Promise<OrderListDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.orders.list({
      page,
      pageSize,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      status: query.status,
      financialStatus: query.financialStatus,
      fulfillmentStatus: query.fulfillmentStatus,
      email: query.email,
      orderId: query.orderId,
      customerName: query.customerName,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      // A bare "YYYY-MM-DD" (no time component, e.g. from a native date input)
      // parses to that day's UTC midnight — used as an inclusive upper bound
      // that would exclude every order placed later that same day. Push it to
      // the end of that day so "dateTo=today" actually includes today.
      dateTo: query.dateTo ? endOfDayIfDateOnly(query.dateTo) : undefined,
    });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      orders: result.orders.map((o) => ({
        publicId: o.publicId,
        orderNumber: o.orderNumber,
        email: o.email,
        customerName: o.customerName,
        paymentMethod: o.paymentMethod,
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

import type { OrderRepository } from '../domain/repositories.js';
import type { ListRefundsQuery, RefundListDto } from './dto.js';
import { endOfDayIfDateOnly } from './list-orders.usecase.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Cross-order Refunds ledger — every row is already written by
 *  RefundOrder's own recordPayment(type: 'REFUND') call; this is purely
 *  the missing aggregation, same thin-usecase shape as ListOrders/
 *  ListFulfillments. */
export class ListRefunds {
  constructor(private readonly orders: OrderRepository) {}

  async execute(query: ListRefundsQuery): Promise<RefundListDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.orders.listRefunds({
      page,
      pageSize,
      method: query.method,
      status: query.status,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? endOfDayIfDateOnly(query.dateTo) : undefined,
    });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      refunds: result.refunds.map((r) => ({
        id: r.id.toString(),
        orderPublicId: r.orderPublicId,
        orderNumber: r.orderNumber,
        email: r.email,
        method: r.method,
        gateway: r.gateway,
        amount: r.amount,
        currency: r.currency,
        status: r.status,
        gatewayRef: r.gatewayRef,
        createdAt: r.createdAt.toISOString(),
      })),
      totalsByCurrency: result.totalsByCurrency,
    };
  }
}

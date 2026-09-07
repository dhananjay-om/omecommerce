import type { OrderRepository } from '../domain/repositories.js';
import type { ListReturnsQuery, ReturnListDto } from './dto.js';
import { endOfDayIfDateOnly } from './list-orders.usecase.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Cross-order Returns list — thin, mirrors ListRefunds/ListFulfillments. */
export class ListReturns {
  constructor(private readonly orders: OrderRepository) {}

  async execute(query: ListReturnsQuery): Promise<ReturnListDto> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.orders.listReturns({
      page,
      pageSize,
      status: query.status,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? endOfDayIfDateOnly(query.dateTo) : undefined,
    });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      returns: result.returns.map((r) => ({
        publicId: r.publicId,
        orderPublicId: r.orderPublicId,
        orderNumber: r.orderNumber,
        email: r.email,
        reason: r.reason,
        status: r.status,
        lineCount: r.lineCount,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}

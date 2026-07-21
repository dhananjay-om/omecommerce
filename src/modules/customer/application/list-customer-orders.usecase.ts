import type { CustomerRepository, CustomerOrderLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CustomerOrderListDto, ListCustomerOrdersQuery } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListCustomerOrders {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly orders: CustomerOrderLookup,
  ) {}

  async execute(customerPublicId: string, query: ListCustomerOrdersQuery = {}): Promise<CustomerOrderListDto> {
    const customer = await this.customers.findByPublicId(customerPublicId);
    if (!customer) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    const result = await this.orders.list(customer.id, { page, pageSize, search: query.search });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      orders: result.orders.map((o) => ({ ...o, placedAt: o.placedAt.toISOString() })),
    };
  }
}

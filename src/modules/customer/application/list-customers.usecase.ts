import type { CustomerRepository } from '../domain/repositories.js';
import type { ListCustomersQuery, CustomerListView } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListCustomers {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(query: ListCustomersQuery): Promise<CustomerListView> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.customers.list({ page, pageSize, search: query.search });
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      customers: result.customers.map((c) => ({
        publicId: c.publicId,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }
}

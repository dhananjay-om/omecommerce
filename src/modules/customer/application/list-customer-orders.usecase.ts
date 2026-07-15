import type { CustomerRepository, CustomerOrderLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CustomerOrderView } from './dto.js';

export class ListCustomerOrders {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly orders: CustomerOrderLookup,
  ) {}

  async execute(customerPublicId: string): Promise<CustomerOrderView[]> {
    const customer = await this.customers.findByPublicId(customerPublicId);
    if (!customer) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const rows = await this.orders.listByCustomerId(customer.id);
    return rows.map((o) => ({ ...o, placedAt: o.placedAt.toISOString() }));
  }
}

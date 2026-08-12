import type { CustomerRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { CustomerView } from './dto.js';

export class GetCustomerProfile {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(customerPublicId: string): Promise<CustomerView> {
    const customer = await this.customers.findByPublicId(customerPublicId);
    if (!customer) {
      throw new NotFoundError('customer', customerPublicId);
    }
    return {
      publicId: customer.publicId,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    };
  }
}

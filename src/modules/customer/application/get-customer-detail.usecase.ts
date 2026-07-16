import type { CustomerRepository, CustomerAddressRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { ListCustomerAddresses } from './customer-address.usecases.js';
import type { CustomerDetailView } from './dto.js';

export class GetCustomerDetail {
  private readonly listAddresses: ListCustomerAddresses;

  constructor(
    private readonly customers: CustomerRepository,
    addresses: CustomerAddressRepository,
  ) {
    this.listAddresses = new ListCustomerAddresses(customers, addresses);
  }

  async execute(customerPublicId: string): Promise<CustomerDetailView> {
    const customer = await this.customers.findByPublicId(customerPublicId);
    if (!customer) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const addresses = await this.listAddresses.execute(customerPublicId);
    return {
      publicId: customer.publicId,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      isActive: customer.isActive,
      createdAt: customer.createdAt.toISOString(),
      addresses,
    };
  }
}

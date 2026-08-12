import type { CustomerRepository, CustomerAddressRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { AddCustomerAddressCommand, CustomerAddressView } from './dto.js';

function toView(a: {
  publicId: string;
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}): CustomerAddressView {
  return { ...a };
}

export class AddCustomerAddress {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly addresses: CustomerAddressRepository,
  ) {}

  async execute(cmd: AddCustomerAddressCommand): Promise<CustomerAddressView> {
    const customer = await this.customers.findByPublicId(cmd.customerPublicId);
    if (!customer) {
      throw new NotFoundError('customer', cmd.customerPublicId);
    }
    const address = await this.addresses.create({ ...cmd, customerId: customer.id });
    return toView(address);
  }
}

export class ListCustomerAddresses {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly addresses: CustomerAddressRepository,
  ) {}

  async execute(customerPublicId: string): Promise<CustomerAddressView[]> {
    const customer = await this.customers.findByPublicId(customerPublicId);
    if (!customer) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const rows = await this.addresses.listByCustomerId(customer.id);
    return rows.map(toView);
  }
}

export class DeleteCustomerAddress {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly addresses: CustomerAddressRepository,
  ) {}

  async execute(customerPublicId: string, addressPublicId: string): Promise<void> {
    const customer = await this.customers.findByPublicId(customerPublicId);
    if (!customer) {
      throw new NotFoundError('customer', customerPublicId);
    }
    // Scoped to (customerId, addressPublicId) at the repository level, so a 404
    // here means either "no such address" or "not this customer's address" —
    // deliberately indistinguishable to the caller (no ownership info leak).
    const deleted = await this.addresses.deleteByPublicId(customer.id, addressPublicId);
    if (!deleted) {
      throw new NotFoundError('address', addressPublicId);
    }
  }
}

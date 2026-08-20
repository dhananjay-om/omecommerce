import type { CustomerRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/**
 * Soft-delete: sets deletedAt + isActive=false — same shape as pricing's
 * DeletePriceList. Never guarded/blocked (a customer's order history, wallet,
 * loyalty, and referral rows are all kept, not cascaded), and LoginCustomer
 * already rejects !isActive, so this is enough to lock the account out
 * immediately without touching anything else.
 */
export class DeleteCustomer {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(publicId: string): Promise<void> {
    const customer = await this.customers.findByPublicId(publicId);
    if (!customer) throw new NotFoundError('customer', publicId);
    await this.customers.softDelete(customer.id);
  }
}

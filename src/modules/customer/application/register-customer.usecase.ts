import type { CustomerRepository, WebsiteLookup } from '../domain/repositories.js';
import type { PasswordHasher } from '../../auth/domain/ports.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import type { RegisterCustomerCommand, CustomerView } from './dto.js';

export class RegisterCustomer {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly websites: WebsiteLookup,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(cmd: RegisterCustomerCommand): Promise<CustomerView> {
    const website = await this.websites.byCode(cmd.websiteCode);
    if (!website) {
      throw new NotFoundError('website', cmd.websiteCode);
    }
    const email = cmd.email.trim();
    if (await this.customers.findByWebsiteAndEmail(website.id, email)) {
      throw new ConflictError(`customer already registered on this website: ${email}`);
    }
    const passwordHash = await this.hasher.hash(cmd.password);
    const customer = await this.customers.create({
      websiteId: website.id,
      email,
      passwordHash,
      firstName: cmd.firstName ?? null,
      lastName: cmd.lastName ?? null,
    });
    return {
      publicId: customer.publicId,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    };
  }
}

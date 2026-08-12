import type { CustomerRepository, WebsiteLookup } from '../domain/repositories.js';
import type { PasswordHasher } from '../../auth/domain/ports.js';
import type { CustomerTokenService } from '../domain/ports.js';
import { DomainError, NotFoundError } from '../../../shared/domain/errors.js';
import type { LoginCustomerCommand, LoginCustomerResult } from './dto.js';

export class InvalidCustomerCredentialsError extends DomainError {
  constructor() {
    super('invalid email or password', 'https://errors.ome/invalid-credentials', 401);
  }
}

export class LoginCustomer {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly websites: WebsiteLookup,
    private readonly hasher: PasswordHasher,
    private readonly tokens: CustomerTokenService,
  ) {}

  async execute(cmd: LoginCustomerCommand): Promise<LoginCustomerResult> {
    const website = await this.websites.byCode(cmd.websiteCode);
    if (!website) {
      throw new NotFoundError('website', cmd.websiteCode);
    }
    const customer = await this.customers.findByWebsiteAndEmail(website.id, cmd.email.trim());
    // Verify against a fixed dummy hash when the customer doesn't exist, so the
    // response time doesn't leak whether the email is registered — same timing-
    // attack mitigation as auth's Login use-case.
    const hashToCheck = customer?.passwordHash ?? DUMMY_HASH;
    const passwordOk = await this.hasher.verify(cmd.password, hashToCheck);

    if (!customer || !customer.isActive || !passwordOk) {
      throw new InvalidCustomerCredentialsError();
    }

    const token = this.tokens.sign({ customerPublicId: customer.publicId });
    return { token, customerPublicId: customer.publicId };
  }
}

const DUMMY_HASH = '0'.repeat(32) + ':' + '0'.repeat(128);

import { Prisma } from '@prisma/client';
import type { CustomerRepository, WebsiteLookup } from '../domain/repositories.js';
import type { PasswordHasher } from '../../auth/domain/ports.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { RegisterCustomerCommand, CustomerView } from './dto.js';

export class RegisterCustomer {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly websites: WebsiteLookup,
    private readonly hasher: PasswordHasher,
    private readonly outbox: OutboxWriter,
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
    // A previously deleted account still holds this email in the DB — free it up first.
    await this.customers.releaseDeletedEmail(website.id, email);
    const passwordHash = await this.hasher.hash(cmd.password);
    let customer;
    try {
      customer = await this.customers.create({
        websiteId: website.id,
        email,
        passwordHash,
        firstName: cmd.firstName ?? null,
        lastName: cmd.lastName ?? null,
      });
    } catch (err) {
      // Two simultaneous sign-ups with the same address: the loser gets the normal
      // "already registered" answer instead of an Internal Server Error.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`customer already registered on this website: ${email}`);
      }
      throw err;
    }

    await this.outbox.write({
      aggregateType: 'Customer',
      aggregateId: customer.publicId,
      eventType: 'CustomerRegistered',
      payload: { email: customer.email },
    });

    return {
      publicId: customer.publicId,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    };
  }
}

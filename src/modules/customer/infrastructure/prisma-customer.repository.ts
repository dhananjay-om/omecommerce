import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CustomerRepository, CustomerRecord, CreateCustomerInput, WebsiteLookup } from '../domain/repositories.js';

const CUSTOMER_SELECT = {
  id: true,
  publicId: true,
  websiteId: true,
  email: true,
  passwordHash: true,
  firstName: true,
  lastName: true,
  isActive: true,
} as const;

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly db: Db) {}

  async findByWebsiteAndEmail(websiteId: bigint, email: string): Promise<CustomerRecord | null> {
    return this.db.customer.findFirst({ where: { websiteId, email }, select: CUSTOMER_SELECT });
  }

  async findByPublicId(publicId: string): Promise<CustomerRecord | null> {
    return this.db.customer.findFirst({ where: { publicId }, select: CUSTOMER_SELECT });
  }

  async create(input: CreateCustomerInput): Promise<CustomerRecord> {
    return this.db.customer.create({
      data: {
        websiteId: input.websiteId,
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
      select: CUSTOMER_SELECT,
    });
  }
}

/** Read-only cross-module lookup: resolves a store website's code (own copy, matching pricing's PrismaWebsiteLookup). */
export class PrismaWebsiteLookup implements WebsiteLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.website.findFirst({ where: { code }, select: { id: true } });
  }
}

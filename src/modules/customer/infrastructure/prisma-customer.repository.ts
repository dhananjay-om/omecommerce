import type { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  CustomerRepository,
  CustomerRecord,
  CreateCustomerInput,
  WebsiteLookup,
  ListCustomersFilter,
  CustomerListResult,
} from '../domain/repositories.js';

const CUSTOMER_SELECT = {
  id: true,
  publicId: true,
  websiteId: true,
  email: true,
  passwordHash: true,
  firstName: true,
  lastName: true,
  isActive: true,
  createdAt: true,
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

  async softDelete(id: bigint): Promise<void> {
    await this.db.customer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async list(filter: ListCustomersFilter): Promise<CustomerListResult> {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(filter.search
        ? {
            OR: [
              { email: { contains: filter.search, mode: 'insensitive' } },
              { firstName: { contains: filter.search, mode: 'insensitive' } },
              { lastName: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.db.$transaction([
      this.db.customer.count({ where }),
      this.db.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return {
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      customers: rows.map((row) => ({
        publicId: row.publicId,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        isActive: row.isActive,
        createdAt: row.createdAt,
      })),
    };
  }
}

/** Read-only cross-module lookup: resolves a store website's code (own copy, matching pricing's PrismaWebsiteLookup). */
export class PrismaWebsiteLookup implements WebsiteLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.website.findFirst({ where: { code }, select: { id: true } });
  }
}

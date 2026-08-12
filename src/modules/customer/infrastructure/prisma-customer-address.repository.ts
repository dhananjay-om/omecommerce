import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  CustomerAddressRepository,
  CustomerAddressRecord,
  CreateCustomerAddressInput,
} from '../domain/repositories.js';

const ADDRESS_SELECT = {
  publicId: true,
  name: true,
  company: true,
  line1: true,
  line2: true,
  city: true,
  region: true,
  postalCode: true,
  country: true,
  phone: true,
  isDefaultShipping: true,
  isDefaultBilling: true,
} as const;

export class PrismaCustomerAddressRepository implements CustomerAddressRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCustomerAddressInput): Promise<CustomerAddressRecord> {
    // At most one default-shipping and one default-billing address per customer
    // (enforced belt-and-suspenders by partial unique indexes in raw SQL) — unset
    // any prior default of the kind(s) this row claims, in the same transaction,
    // so two concurrent "set as default" requests can't both leave the flag set
    // (schema-reviewer finding: without this, "get the default address" becomes
    // non-deterministic).
    return this.db.$transaction(async (tx) => {
      if (input.isDefaultShipping) {
        await tx.customerAddress.updateMany({
          where: { customerId: input.customerId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }
      if (input.isDefaultBilling) {
        await tx.customerAddress.updateMany({
          where: { customerId: input.customerId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }
      return tx.customerAddress.create({
        data: {
          customerId: input.customerId,
          name: input.name,
          company: input.company,
          line1: input.line1,
          line2: input.line2,
          city: input.city,
          region: input.region,
          postalCode: input.postalCode,
          country: input.country,
          phone: input.phone,
          isDefaultShipping: input.isDefaultShipping,
          isDefaultBilling: input.isDefaultBilling,
        },
        select: ADDRESS_SELECT,
      });
    });
  }

  async listByCustomerId(customerId: bigint): Promise<CustomerAddressRecord[]> {
    return this.db.customerAddress.findMany({ where: { customerId }, select: ADDRESS_SELECT, orderBy: { id: 'asc' } });
  }

  async deleteByPublicId(customerId: bigint, addressPublicId: string): Promise<boolean> {
    const result = await this.db.customerAddress.deleteMany({ where: { customerId, publicId: addressPublicId } });
    return result.count > 0;
  }
}
